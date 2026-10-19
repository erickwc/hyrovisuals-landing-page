-- Keep the checkout email for receipts and support, while ownership follows the HYRO intent.
alter table public.orders add column if not exists buyer_email text
  check (buyer_email is null or
    (length(buyer_email) between 3 and 320 and buyer_email = lower(trim(buyer_email))));

-- New signature lets the old webhook continue working during the deployment window.
create or replace function public.complete_payhip_purchase(
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
     or p_buyer_email is null or length(trim(p_buyer_email)) not between 3 and 320
     or position('@' in p_buyer_email) < 2 then
    raise exception 'invalid Payhip purchase' using errcode = '22023';
  end if;
  select o.id into v_order_id from public.orders o
    where o.payhip_transaction_id = p_transaction_id;
  if found then return v_order_id; end if;
  select * into v_intent from public.purchase_intents
    where id = p_intent_id for update;
  if not found or v_intent.consumed_at is not null
     or v_intent.created_at < now() - interval '24 hours' then
    raise exception 'invalid or expired purchase intent';
  end if;
  select * into v_product from public.products
    where id = v_intent.product_id and slug = p_product_slug and is_active;
  if not found then raise exception 'unknown product'; end if;
  insert into public.orders
    (user_id, status, total_cents, currency, payhip_transaction_id, buyer_email, paid_at)
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
revoke all on function public.complete_payhip_purchase(
  uuid,text,text,integer,text,bytea,bytea,bytea,text) from public, anon, authenticated;
grant execute on function public.complete_payhip_purchase(
  uuid,text,text,integer,text,bytea,bytea,bytea,text) to service_role;
