-- Additive Live-only ledger. Payhip and Sandbox never write this table.
create table public.paypal_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  product_id uuid not null references public.products(id),
  request_id uuid not null,
  paypal_order_id text unique check (paypal_order_id ~ '^[A-Z0-9]{17}$'),
  capture_1 text unique check (capture_1 ~ '^[A-Z0-9]{17}$'),
  capture_2 text unique check (capture_2 ~ '^[A-Z0-9]{17}$'),
  order_id uuid unique references public.orders(id),
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  check (capture_1 is null or capture_2 is null or capture_1 <> capture_2),
  check (status <> 'paid' or (order_id is not null and capture_1 is not null and capture_2 is not null))
);
alter table public.paypal_checkouts enable row level security;
revoke all on public.paypal_checkouts from public, anon, authenticated;
grant select on public.paypal_checkouts to authenticated;
grant select, insert, update on public.paypal_checkouts to service_role;
create policy paypal_checkouts_owner_read on public.paypal_checkouts for select to authenticated
  using (user_id = (select auth.uid()));

-- Service role only; keep RLS enabled, and avoid SECURITY DEFINER.
grant select, update on public.profiles to service_role;
grant select on public.products to service_role;
grant select, insert, update on public.orders, public.order_items, public.licenses to service_role;
grant select, update on public.license_activations to service_role;
create function public.complete_paypal_purchase(
  p_checkout_id uuid, p_paypal_order_id text, p_capture_1 text, p_capture_2 text,
  p_buyer_email text, p_key_hash bytea, p_key_ciphertext bytea, p_key_nonce bytea
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_checkout public.paypal_checkouts%rowtype;
  v_product public.products%rowtype;
  v_order_id uuid;
  v_item_id uuid;
begin
  if p_paypal_order_id is null or p_paypal_order_id !~ '^[A-Z0-9]{17}$'
     or p_capture_1 is null or p_capture_1 !~ '^[A-Z0-9]{17}$'
     or p_capture_2 is null or p_capture_2 !~ '^[A-Z0-9]{17}$' or p_capture_1 = p_capture_2
     or p_key_hash is null or octet_length(p_key_hash) <> 32
     or p_key_nonce is null or octet_length(p_key_nonce) <> 12
     or p_key_ciphertext is null or octet_length(p_key_ciphertext) <= 32
     or (p_buyer_email is not null and (length(trim(p_buyer_email)) not between 3 and 320 or position('@' in p_buyer_email) < 2)) then
    raise exception 'invalid PayPal purchase' using errcode = '22023';
  end if;
  select * into v_checkout from public.paypal_checkouts where id = p_checkout_id for update;
  if not found or v_checkout.paypal_order_id is distinct from p_paypal_order_id
     or v_checkout.status = 'refunded' then raise exception 'invalid checkout'; end if;
  if v_checkout.status = 'paid' then
    if v_checkout.capture_1 <> p_capture_1 or v_checkout.capture_2 <> p_capture_2 then raise exception 'capture mismatch'; end if;
    return v_checkout.order_id;
  end if;
  -- Serialize concurrent completed checkouts for one customer so one license survives.
  perform 1 from public.profiles where id = v_checkout.user_id for update;
  select * into v_product from public.products where id = v_checkout.product_id
    and slug = 'hyro-visuals' and price_cents = 2000 and currency = 'USD';
  if not found then raise exception 'invalid product'; end if;
  insert into public.orders (user_id,status,total_cents,currency,paypal_order_id,paypal_capture_id,buyer_email,paid_at)
    values (v_checkout.user_id,'paid',2000,'USD',p_paypal_order_id,p_capture_1,lower(trim(p_buyer_email)),now()) returning id into v_order_id;
  insert into public.order_items (order_id,product_id,unit_price_cents,currency,quantity)
    values (v_order_id,v_product.id,2000,'USD',1) returning id into v_item_id;
  if exists (select 1 from public.licenses where user_id = v_checkout.user_id and product_id = v_product.id and status = 'revoked') then
    update public.licenses set order_id=v_order_id, order_item_id=v_item_id, key_hash=p_key_hash,
      key_ciphertext=p_key_ciphertext, key_nonce=p_key_nonce, key_version=1, status='active',
      issued_at=now(), revoked_at=null, activation_epoch=activation_epoch+1
      where user_id=v_checkout.user_id and product_id=v_product.id;
    update public.license_activations set deactivated_at=now()
      where license_id in (select id from public.licenses where user_id=v_checkout.user_id and product_id=v_product.id)
        and deactivated_at is null;
  elsif not exists (select 1 from public.licenses where user_id=v_checkout.user_id and product_id=v_product.id) then
    insert into public.licenses (user_id,product_id,order_id,order_item_id,key_hash,key_ciphertext,key_nonce,key_version)
      values (v_checkout.user_id,v_product.id,v_order_id,v_item_id,p_key_hash,p_key_ciphertext,p_key_nonce,1);
  end if;
  update public.paypal_checkouts set status='paid',order_id=v_order_id,capture_1=p_capture_1,capture_2=p_capture_2 where id=p_checkout_id;
  return v_order_id;
end $$;
revoke all on function public.complete_paypal_purchase(uuid,text,text,text,text,bytea,bytea,bytea) from public,anon,authenticated;
grant execute on function public.complete_paypal_purchase(uuid,text,text,text,text,bytea,bytea,bytea) to service_role;

create function public.refund_paypal_purchase(p_checkout_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_checkout public.paypal_checkouts%rowtype;
begin
  select * into v_checkout from public.paypal_checkouts where id=p_checkout_id for update;
  if not found then raise exception 'unknown checkout'; end if;
  update public.paypal_checkouts set status='refunded' where id=p_checkout_id;
  if v_checkout.order_id is not null then
    update public.orders set status='refunded',updated_at=now() where id=v_checkout.order_id;
    update public.licenses set status='revoked',revoked_at=now(),activation_epoch=activation_epoch+1
      where order_id=v_checkout.order_id and status <> 'revoked';
    update public.license_activations set deactivated_at=now()
      where license_id in (select id from public.licenses where order_id=v_checkout.order_id) and deactivated_at is null;
  end if;
end $$;
revoke all on function public.refund_paypal_purchase(uuid) from public,anon,authenticated;
grant execute on function public.refund_paypal_purchase(uuid) to service_role;
