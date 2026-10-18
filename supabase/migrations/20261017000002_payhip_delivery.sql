-- A Payhip checkout is linked to an authenticated HYRO account by an opaque intent.
create table if not exists public.purchase_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  product_id uuid not null references public.products(id),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint purchase_intents_fresh check (consumed_at is null or consumed_at >= created_at)
);
create index if not exists purchase_intents_user_created_idx on public.purchase_intents(user_id, created_at desc);
alter table public.purchase_intents enable row level security;
create policy purchase_intents_self_insert on public.purchase_intents for insert to authenticated
  with check (user_id = (select auth.uid()) and consumed_at is null);
create policy purchase_intents_self_read on public.purchase_intents for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.purchase_intents from anon;
grant select, insert on public.purchase_intents to authenticated;

alter table public.orders add column if not exists payhip_transaction_id text;
create unique index if not exists orders_payhip_transaction_id_key
  on public.orders(payhip_transaction_id) where payhip_transaction_id is not null;
alter table public.orders drop constraint if exists paid_has_capture;
alter table public.orders add constraint paid_has_gateway_transaction check (
  status <> 'paid' or (paid_at is not null and
    ((paypal_capture_id is not null and payhip_transaction_id is null) or
     (paypal_capture_id is null and payhip_transaction_id is not null)))
);

drop policy if exists products_licensed_read on public.products;
create policy products_licensed_read on public.products for select to authenticated
  using (exists (select 1 from public.licenses l
    where l.product_id = products.id and l.user_id = (select auth.uid()) and l.status = 'active'));

insert into public.products (slug, name, description, price_cents, currency, is_active)
values ('hyro-visuals', 'HYRO Visuals', 'Licencia personal de HYRO Visuals', 2000, 'USD', true)
on conflict (slug) do nothing;

-- All order and license writes remain server-only. These routines are executable by service_role only.
create or replace function public.complete_payhip_purchase(
  p_intent_id uuid, p_transaction_id text, p_product_slug text, p_amount_cents integer,
  p_currency text, p_key_hash bytea, p_key_ciphertext bytea, p_key_nonce bytea
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_intent public.purchase_intents%rowtype;
declare v_product public.products%rowtype;
declare v_order_id uuid;
declare v_item_id uuid;
begin
  if p_transaction_id is null or length(p_transaction_id) < 4 or p_amount_cents < 0
     or p_currency !~ '^[A-Z]{3}$' or octet_length(p_key_hash) <> 32
     or octet_length(p_key_nonce) <> 12 or octet_length(p_key_ciphertext) <= 32 then
    raise exception 'invalid Payhip purchase';
  end if;
  select id into v_order_id from public.orders where payhip_transaction_id = p_transaction_id;
  if found then return v_order_id; end if;
  select * into v_intent from public.purchase_intents where id = p_intent_id for update;
  if not found or v_intent.consumed_at is not null or v_intent.created_at < now() - interval '24 hours' then
    raise exception 'invalid or expired purchase intent';
  end if;
  select * into v_product from public.products where id = v_intent.product_id and slug = p_product_slug and is_active;
  if not found then raise exception 'unknown product'; end if;
  insert into public.orders (user_id, status, total_cents, currency, payhip_transaction_id, paid_at)
    values (v_intent.user_id, 'paid', p_amount_cents, p_currency, p_transaction_id, now())
    returning id into v_order_id;
  insert into public.order_items (order_id, product_id, unit_price_cents, currency, quantity)
    values (v_order_id, v_product.id, p_amount_cents, p_currency, 1) returning id into v_item_id;
  if not exists (select 1 from public.licenses where user_id = v_intent.user_id and product_id = v_product.id) then
    insert into public.licenses (user_id, product_id, order_id, order_item_id, key_hash,
      key_ciphertext, key_nonce, key_version)
      values (v_intent.user_id, v_product.id, v_order_id, v_item_id, p_key_hash,
        p_key_ciphertext, p_key_nonce, 1);
  end if;
  update public.purchase_intents set consumed_at = now() where id = p_intent_id;
  return v_order_id;
end $$;

create or replace function public.refund_payhip_purchase(p_transaction_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_order_id uuid;
begin
  select id into v_order_id from public.orders where payhip_transaction_id = p_transaction_id for update;
  if not found then return false; end if;
  update public.orders set status = 'refunded', updated_at = now() where id = v_order_id and status <> 'refunded';
  update public.licenses set status = 'revoked', revoked_at = now()
    where order_id = v_order_id and status <> 'revoked';
  return true;
end $$;

revoke all on function public.complete_payhip_purchase(uuid,text,text,integer,text,bytea,bytea,bytea) from public, anon, authenticated;
revoke all on function public.refund_payhip_purchase(text) from public, anon, authenticated;
grant execute on function public.complete_payhip_purchase(uuid,text,text,integer,text,bytea,bytea,bytea) to service_role;
grant execute on function public.refund_payhip_purchase(text) to service_role;
