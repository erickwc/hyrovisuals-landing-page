-- Append this after the migration inside BEGIN, then ROLLBACK (never COMMIT).
do $$
declare
  customer uuid;
  product uuid;
  checkout uuid;
  first_order uuid;
  second_order uuid;
  stored_hash bytea;
  key_hash bytea := decode(repeat('ab',32),'hex');
  ciphertext bytea := decode(repeat('cd',40),'hex');
  nonce bytea := decode(repeat('ef',12),'hex');
begin
  select id into customer from public.profiles order by created_at limit 1;
  select id into product from public.products where slug='hyro-visuals';
  if customer is null or product is null then raise exception 'Missing existing HYRO fixture'; end if;
  insert into public.paypal_checkouts(user_id,product_id,request_id,paypal_order_id)
    values(customer,product,gen_random_uuid(),'99Y34524KY3960236') returning id into checkout;
  first_order := public.complete_paypal_purchase(checkout,'99Y34524KY3960236','9HN41519CA055632X','94A103886X5533306',
    'rollback-test@example.com',key_hash,ciphertext,nonce);
  select l.key_hash into stored_hash from public.licenses l where l.user_id=customer and l.product_id=product;
  second_order := public.complete_paypal_purchase(checkout,'99Y34524KY3960236','9HN41519CA055632X','94A103886X5533306',
    'rollback-test@example.com',decode(repeat('aa',32),'hex'),ciphertext,nonce);
  if first_order <> second_order or not exists(select 1 from public.licenses l where l.user_id=customer and l.product_id=product and l.status='active' and l.key_hash=stored_hash) then
    raise exception 'License/idempotency check failed';
  end if;
  if has_function_privilege('authenticated','public.complete_paypal_purchase(uuid,text,text,text,text,bytea,bytea,bytea)','execute') then
    raise exception 'Customer can issue a license';
  end if;
  perform public.refund_paypal_purchase(checkout);
  if exists(select 1 from public.licenses where order_id=first_order and status='active') then raise exception 'Refund did not revoke owned license'; end if;
end $$;
