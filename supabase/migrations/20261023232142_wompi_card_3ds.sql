-- Never add PAN, CVV, expiry or billing-address columns to this ledger.
create table public.wompi_card_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  product_id uuid not null references public.products(id),
  request_id uuid not null,
  is_productive boolean not null,
  buyer_email text not null check(length(buyer_email) between 3 and 320),
  transaction_id uuid unique,
  challenge_url text,
  status text not null default 'creating' check(status in ('creating','awaiting_3ds','review','declined','test_paid','paid')),
  order_id uuid unique references public.orders(id),
  created_at timestamptz not null default now(),
  unique(user_id,request_id),
  check(status <> 'paid' or (is_productive and order_id is not null and transaction_id is not null)),
  check(status <> 'test_paid' or (not is_productive and order_id is null and transaction_id is not null))
);
create unique index wompi_card_one_open on public.wompi_card_checkouts(user_id,product_id)
  where status in ('creating','awaiting_3ds','review');
create index wompi_card_owner_created on public.wompi_card_checkouts(user_id,created_at desc);
alter table public.wompi_card_checkouts enable row level security;
revoke all on public.wompi_card_checkouts from public,anon,authenticated;
grant select,insert,update on public.wompi_card_checkouts to service_role;
grant select,update on public.profiles to service_role;
grant select on public.products to service_role;
grant select,insert,update on public.orders,public.order_items,public.licenses to service_role;
grant select,update on public.license_activations to service_role;

create function public.reserve_wompi_card_checkout(p_user_id uuid,p_request_id uuid,p_is_productive boolean,p_buyer_email text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_checkout public.wompi_card_checkouts%rowtype; v_product public.products%rowtype;
begin
  if p_user_id is null or p_request_id is null or p_is_productive is null or p_buyer_email is null
     or length(p_buyer_email) not between 3 and 320 then raise exception 'invalid checkout'; end if;
  perform 1 from public.profiles where id=p_user_id for update;
  if not found then raise exception 'unknown customer'; end if;
  select * into v_product from public.products where slug='hyro-visuals' and is_active and price_cents=2000 and currency='USD';
  if not found then raise exception 'product unavailable'; end if;
  if exists(select 1 from public.licenses where user_id=p_user_id and product_id=v_product.id and status='active') then
    return jsonb_build_object('library_url','/biblioteca/');
  end if;
  select * into v_checkout from public.wompi_card_checkouts where user_id=p_user_id and request_id=p_request_id;
  if not found then
    select * into v_checkout from public.wompi_card_checkouts where user_id=p_user_id and product_id=v_product.id
      and status in ('creating','awaiting_3ds','review') order by created_at desc limit 1;
  end if;
  if found then return jsonb_build_object('checkout',to_jsonb(v_checkout),'claimed',false); end if;
  if (select count(*) from public.wompi_card_checkouts where user_id=p_user_id and created_at>now()-interval '15 minutes') >= 3 then
    return jsonb_build_object('limited',true);
  end if;
  insert into public.wompi_card_checkouts(user_id,product_id,request_id,is_productive,buyer_email)
    values(p_user_id,v_product.id,p_request_id,p_is_productive,lower(trim(p_buyer_email))) returning * into v_checkout;
  return jsonb_build_object('checkout',to_jsonb(v_checkout),'claimed',true);
end $$;

create function public.bind_wompi_card_transaction(p_checkout_id uuid,p_transaction_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_checkout public.wompi_card_checkouts%rowtype;
begin
  if p_transaction_id is null then raise exception 'invalid transaction'; end if;
  select * into v_checkout from public.wompi_card_checkouts where id=p_checkout_id for update;
  if not found or (v_checkout.transaction_id is not null and v_checkout.transaction_id<>p_transaction_id) then
    raise exception 'transaction mismatch';
  end if;
  update public.wompi_card_checkouts set transaction_id=p_transaction_id where id=p_checkout_id;
end $$;

create function public.complete_wompi_card_purchase(p_checkout_id uuid,p_transaction_id uuid,
  p_key_hash bytea,p_key_ciphertext bytea,p_key_nonce bytea)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_checkout public.wompi_card_checkouts%rowtype; v_order uuid; v_item uuid;
begin
  if p_transaction_id is null or p_key_hash is null or octet_length(p_key_hash)<>32 or
    p_key_nonce is null or octet_length(p_key_nonce)<>12 or p_key_ciphertext is null or octet_length(p_key_ciphertext)<=32 then
    raise exception 'invalid license';
  end if;
  select * into v_checkout from public.wompi_card_checkouts where id=p_checkout_id;
  if not found then raise exception 'unknown checkout'; end if;
  -- Same locking order as reservation: profile, then checkout.
  perform 1 from public.profiles where id=v_checkout.user_id for update;
  select * into v_checkout from public.wompi_card_checkouts where id=p_checkout_id for update;
  if v_checkout.is_productive is distinct from true or v_checkout.transaction_id is distinct from p_transaction_id then
    raise exception 'unverified checkout';
  end if;
  if v_checkout.status='paid' then return v_checkout.order_id; end if;
  insert into public.orders(user_id,status,total_cents,currency,wompi_transaction_id,buyer_email,paid_at)
    values(v_checkout.user_id,'paid',2000,'USD',p_transaction_id,v_checkout.buyer_email,now()) returning id into v_order;
  insert into public.order_items(order_id,product_id,unit_price_cents,currency,quantity)
    values(v_order,v_checkout.product_id,2000,'USD',1) returning id into v_item;
  if exists(select 1 from public.licenses where user_id=v_checkout.user_id and product_id=v_checkout.product_id and status='revoked') then
    update public.licenses set order_id=v_order,order_item_id=v_item,key_hash=p_key_hash,key_ciphertext=p_key_ciphertext,
      key_nonce=p_key_nonce,key_version=1,status='active',issued_at=now(),revoked_at=null,activation_epoch=activation_epoch+1
      where user_id=v_checkout.user_id and product_id=v_checkout.product_id;
    update public.license_activations set deactivated_at=now() where license_id in
      (select id from public.licenses where user_id=v_checkout.user_id and product_id=v_checkout.product_id) and deactivated_at is null;
  elsif not exists(select 1 from public.licenses where user_id=v_checkout.user_id and product_id=v_checkout.product_id) then
    insert into public.licenses(user_id,product_id,order_id,order_item_id,key_hash,key_ciphertext,key_nonce,key_version)
      values(v_checkout.user_id,v_checkout.product_id,v_order,v_item,p_key_hash,p_key_ciphertext,p_key_nonce,1);
  end if;
  update public.wompi_card_checkouts set status='paid',order_id=v_order,challenge_url=null where id=p_checkout_id;
  return v_order;
end $$;
revoke all on function public.reserve_wompi_card_checkout(uuid,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.bind_wompi_card_transaction(uuid,uuid) from public,anon,authenticated;
revoke all on function public.complete_wompi_card_purchase(uuid,uuid,bytea,bytea,bytea) from public,anon,authenticated;
grant execute on function public.reserve_wompi_card_checkout(uuid,uuid,boolean,text) to service_role;
grant execute on function public.bind_wompi_card_transaction(uuid,uuid) to service_role;
grant execute on function public.complete_wompi_card_purchase(uuid,uuid,bytea,bytea,bytea) to service_role;
