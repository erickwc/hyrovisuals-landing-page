-- Additive Wompi ledger. Payhip tables, webhook and checkout remain intact.
create table public.wompi_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  product_id uuid not null references public.products(id),
  request_id uuid not null,
  link_id bigint unique,
  link_url text,
  is_productive boolean,
  transaction_id uuid unique,
  order_id uuid unique references public.orders(id),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  check ((link_id is null and link_url is null and is_productive is null) or
         (link_id is not null and link_url is not null and is_productive is not null)),
  check (status <> 'paid' or (transaction_id is not null and order_id is not null and is_productive = true))
);
create index wompi_checkouts_owner_idx on public.wompi_checkouts(user_id, created_at desc);
alter table public.wompi_checkouts enable row level security;
revoke all on public.wompi_checkouts from public, anon, authenticated;
grant select, insert, update on public.wompi_checkouts to service_role;

alter table public.orders add column wompi_transaction_id uuid;
create unique index orders_wompi_transaction_unique on public.orders(wompi_transaction_id)
  where wompi_transaction_id is not null;
alter table public.orders drop constraint paid_has_gateway_transaction;
alter table public.orders add constraint paid_has_gateway_transaction check (
  status <> 'paid' or (paid_at is not null and num_nonnulls(
    paypal_capture_id, payhip_transaction_id, wompi_transaction_id) = 1)
);

-- Only service_role can call the atomic, idempotent fulfillment routine.
create function public.complete_wompi_purchase(
  p_checkout_id uuid, p_link_id bigint, p_transaction_id uuid, p_buyer_email text,
  p_key_hash bytea, p_key_ciphertext bytea, p_key_nonce bytea
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_checkout public.wompi_checkouts%rowtype;
  v_product public.products%rowtype;
  v_order_id uuid;
  v_item_id uuid;
begin
  if p_transaction_id is null or p_link_id is null or
     octet_length(p_key_hash) <> 32 or octet_length(p_key_nonce) <> 12 or
     octet_length(p_key_ciphertext) <= 32 or
     (p_buyer_email is not null and (length(trim(p_buyer_email)) not between 3 and 320 or position('@' in p_buyer_email) < 2))
  then raise exception 'invalid Wompi purchase'; end if;
  select * into v_checkout from public.wompi_checkouts where id = p_checkout_id for update;
  if not found or v_checkout.link_id is distinct from p_link_id or v_checkout.is_productive is distinct from true
  then raise exception 'invalid Wompi checkout'; end if;
  if v_checkout.status = 'paid' then
    if v_checkout.transaction_id is distinct from p_transaction_id then raise exception 'transaction mismatch'; end if;
    return v_checkout.order_id;
  end if;
  perform 1 from public.profiles where id = v_checkout.user_id for update;
  select * into v_product from public.products where id = v_checkout.product_id
    and slug = 'hyro-visuals' and price_cents = 2000 and currency = 'USD' and is_active;
  if not found then raise exception 'invalid product'; end if;
  insert into public.orders(user_id,status,total_cents,currency,wompi_transaction_id,buyer_email,paid_at)
    values(v_checkout.user_id,'paid',2000,'USD',p_transaction_id,lower(trim(p_buyer_email)),now())
    returning id into v_order_id;
  insert into public.order_items(order_id,product_id,unit_price_cents,currency,quantity)
    values(v_order_id,v_product.id,2000,'USD',1) returning id into v_item_id;
  if exists (select 1 from public.licenses where user_id=v_checkout.user_id and product_id=v_product.id and status='revoked') then
    update public.licenses set order_id=v_order_id,order_item_id=v_item_id,key_hash=p_key_hash,
      key_ciphertext=p_key_ciphertext,key_nonce=p_key_nonce,key_version=1,status='active',
      issued_at=now(),revoked_at=null,activation_epoch=activation_epoch+1
      where user_id=v_checkout.user_id and product_id=v_product.id;
    update public.license_activations set deactivated_at=now() where license_id in
      (select id from public.licenses where user_id=v_checkout.user_id and product_id=v_product.id)
      and deactivated_at is null;
  elsif not exists (select 1 from public.licenses where user_id=v_checkout.user_id and product_id=v_product.id) then
    insert into public.licenses(user_id,product_id,order_id,order_item_id,key_hash,key_ciphertext,key_nonce,key_version)
      values(v_checkout.user_id,v_product.id,v_order_id,v_item_id,p_key_hash,p_key_ciphertext,p_key_nonce,1);
  end if;
  update public.wompi_checkouts set status='paid',transaction_id=p_transaction_id,order_id=v_order_id where id=p_checkout_id;
  return v_order_id;
end $$;
revoke all on function public.complete_wompi_purchase(uuid,bigint,uuid,text,bytea,bytea,bytea) from public,anon,authenticated;
grant execute on function public.complete_wompi_purchase(uuid,bigint,uuid,text,bytea,bytea,bytea) to service_role;
