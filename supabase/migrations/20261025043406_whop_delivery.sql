-- Whop is additive: historical Payhip and PayPal purchases stay valid.
alter table public.orders add column if not exists whop_payment_id text;
create unique index if not exists orders_whop_payment_id_key on public.orders(whop_payment_id) where whop_payment_id is not null;
alter table public.orders drop constraint paid_has_gateway_transaction;
alter table public.orders add constraint paid_has_gateway_transaction check (
 status <> 'paid' or (paid_at is not null and num_nonnulls(paypal_capture_id,payhip_transaction_id,whop_payment_id)=1)
);
create table public.whop_refunds (payment_id text primary key, created_at timestamptz not null default now());
alter table public.whop_refunds enable row level security;
revoke all on public.whop_refunds from public, anon, authenticated;
grant all on public.whop_refunds to service_role;
create or replace function public.complete_whop_purchase(
  p_intent_id uuid, p_transaction_id text, p_product_slug text, p_amount_cents integer,
  p_currency text, p_key_hash bytea, p_key_ciphertext bytea, p_key_nonce bytea,
  p_buyer_email text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_intent public.purchase_intents%rowtype;
  v_product public.products%rowtype;
  v_order_id uuid;
  v_item_id uuid;
begin
  if p_transaction_id is null or length(p_transaction_id) not between 4 and 128
     or p_amount_cents < 0 or p_currency !~ '^[A-Z]{3}$'
     or octet_length(p_key_hash) <> 32 or octet_length(p_key_nonce) <> 12
     or octet_length(p_key_ciphertext) <= 32
     or (p_buyer_email is not null and (length(trim(p_buyer_email)) not between 3 and 320
     or position('@' in p_buyer_email) < 2)) then
    raise exception 'invalid Whop purchase' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_transaction_id, 0));
  if exists(select 1 from public.whop_refunds where payment_id = p_transaction_id) then
    return null;
  end if;
  select o.id into v_order_id from public.orders o
    where o.whop_payment_id = p_transaction_id;
  if found then return v_order_id; end if;
  select * into v_intent from public.purchase_intents
    where id = p_intent_id for update;
  if not found or v_intent.consumed_at is not null
 then
    raise exception 'invalid or expired purchase intent';
  end if;
  select * into v_product from public.products
    where id = v_intent.product_id and slug = p_product_slug and is_active;
  if not found then raise exception 'unknown product'; end if;
  -- Serialize purchases for the same account/product, including different intents.
  perform pg_advisory_xact_lock(hashtextextended(v_intent.user_id::text || v_product.id::text, 0));
  insert into public.orders
    (user_id, status, total_cents, currency, whop_payment_id, buyer_email, paid_at)
    values (v_intent.user_id, 'paid', p_amount_cents, p_currency,
      p_transaction_id, lower(trim(p_buyer_email)), now())
    returning id into v_order_id;
  insert into public.order_items (order_id, product_id, unit_price_cents, currency, quantity)
    values (v_order_id, v_product.id, p_amount_cents, p_currency, 1)
    returning id into v_item_id;
  if exists (select 1 from public.licenses
      where user_id = v_intent.user_id and product_id = v_product.id and status = 'revoked') then
    update public.licenses set order_id = v_order_id, order_item_id = v_item_id,
      key_hash = p_key_hash, key_ciphertext = p_key_ciphertext,
      key_nonce = p_key_nonce, key_version = 1, status = 'active',
      issued_at = now(), revoked_at = null, activation_epoch = activation_epoch + 1
      where user_id = v_intent.user_id and product_id = v_product.id;
    update public.license_activations set deactivated_at = now()
      where license_id in (select id from public.licenses
        where user_id = v_intent.user_id and product_id = v_product.id)
        and deactivated_at is null;
  elsif not exists (select 1 from public.licenses
      where user_id = v_intent.user_id and product_id = v_product.id) then
    insert into public.licenses (user_id, product_id, order_id, order_item_id,
      key_hash, key_ciphertext, key_nonce, key_version)
      values (v_intent.user_id, v_product.id, v_order_id, v_item_id,
        p_key_hash, p_key_ciphertext, p_key_nonce, 1);
  end if;
  update public.purchase_intents set consumed_at = now() where id = p_intent_id;
  return v_order_id;
end $$;
revoke all on function public.complete_whop_purchase(
  uuid,text,text,integer,text,bytea,bytea,bytea,text) from public, anon, authenticated;
grant execute on function public.complete_whop_purchase(
  uuid,text,text,integer,text,bytea,bytea,bytea,text) to service_role;

create or replace function public.refund_whop_purchase(p_transaction_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_order_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_transaction_id, 0));
  insert into public.whop_refunds(payment_id) values(p_transaction_id) on conflict do nothing;
  select id into v_order_id from public.orders where whop_payment_id=p_transaction_id for update;
  if not found then return false; end if;
  update public.orders set status='refunded',updated_at=now() where id=v_order_id;
  update public.licenses set status='revoked',revoked_at=now(),activation_epoch=activation_epoch+1
    where order_id=v_order_id and status <> 'revoked';
  update public.license_activations set deactivated_at=now()
    where license_id in (select id from public.licenses where order_id=v_order_id) and deactivated_at is null;
  return true;
end $$;
revoke all on function public.refund_whop_purchase(text) from public,anon,authenticated;
grant execute on function public.refund_whop_purchase(text) to service_role;
