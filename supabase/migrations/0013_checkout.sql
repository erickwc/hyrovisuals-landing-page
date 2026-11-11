-- Cobro sin pasarela atada. El precio y el cupón siempre se calculan aquí (el navegador nunca decide el monto).
--
--   checkout_quote       vista previa del total con cupón (la usa el checkout)
--   checkout_claim_free  pedido de $0 con un cupón del 100 %: se registra pagado y genera las claves
--   confirm_purchase     el ÚNICO punto por donde la pasarela que se conecte registra un pago confirmado
--                        (solo la llave de servicio; idempotente por provider_ref). Al quedar 'paid',
--                        el trigger purchases_handle_paid genera tantas claves como diga el plan.

-- Los cupones solo se gastan desde estas funciones del servidor.
revoke execute on function public.redeem_coupon(text, uuid) from public, anon, authenticated;

create or replace function public.checkout_quote(p_product_slug text, p_plan_id text, p_coupon text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_product public.products;
  v_plan public.plans;
  v_coupon public.coupons;
  v_code text := nullif(upper(trim(coalesce(p_coupon, ''))), '');
  v_price numeric;
  v_discount numeric := 0;
begin
  select * into v_product from public.products where slug = p_product_slug;
  if not found then return jsonb_build_object('error', 'Producto inválido'); end if;
  select * into v_plan from public.plans where product_id = v_product.id and id = p_plan_id and active;
  if not found then return jsonb_build_object('error', 'Plan inválido'); end if;
  v_price := v_plan.price_usd;

  if v_code is not null then
    select * into v_coupon from public.coupons where code = v_code;
    if not found then return jsonb_build_object('error', 'Cupón inválido'); end if;
    if not v_coupon.active then return jsonb_build_object('error', 'Cupón inactivo'); end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at < now() then return jsonb_build_object('error', 'Cupón vencido'); end if;
    if v_coupon.max_uses is not null and v_coupon.uses_count >= v_coupon.max_uses then return jsonb_build_object('error', 'Cupón agotado'); end if;
    if v_coupon.product_id is not null and v_coupon.product_id <> v_product.id then
      return jsonb_build_object('error', 'Cupón no válido para este producto');
    end if;
    v_discount := round(least(case when v_coupon.discount_type = 'percent'
                                   then v_price * v_coupon.discount_value / 100
                                   else v_coupon.discount_value end, v_price), 2);
  end if;

  return jsonb_build_object(
    'productId', v_product.id, 'planId', v_plan.id, 'price', v_price,
    'discount', v_discount, 'amount', round(v_price - v_discount, 2),
    'code', case when v_coupon.id is null then null else v_code end, 'couponId', v_coupon.id);
end;
$fn$;

create or replace function public.checkout_claim_free(p_product_slug text, p_plan_id text, p_coupon text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user uuid := auth.uid();
  v_quote jsonb;
  v_id uuid;
begin
  if v_user is null then return jsonb_build_object('error', 'No autenticado'); end if;
  v_quote := public.checkout_quote(p_product_slug, p_plan_id, p_coupon);
  if v_quote ? 'error' then return v_quote; end if;
  if (v_quote ->> 'amount')::numeric > 0 or v_quote ->> 'couponId' is null then
    return jsonb_build_object('error', 'payment_required');
  end if;
  -- gasta el uso con bloqueo: si dos personas usan el último uso a la vez, solo una pasa
  perform public.redeem_coupon(p_coupon, (v_quote ->> 'productId')::uuid);
  insert into public.purchases (user_id, product_id, plan_id, amount, discount_amount, coupon_id, currency, status,
                                provider, fee_percent, fee_amount, net_amount, paid_at)
  values (v_user, (v_quote ->> 'productId')::uuid, v_quote ->> 'planId', 0, (v_quote ->> 'discount')::numeric,
          (v_quote ->> 'couponId')::uuid, 'USD', 'paid', null, 0, 0, 0, now())
  returning id into v_id;
  return jsonb_build_object('purchaseId', v_id);
exception when raise_exception then
  return jsonb_build_object('error', sqlerrm);
end;
$fn$;

create or replace function public.confirm_purchase(
  p_user_id uuid, p_product_id uuid, p_plan_id text, p_amount numeric,
  p_provider text, p_provider_ref text,
  p_discount numeric default null, p_coupon_id uuid default null, p_currency text default 'USD')
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
  v_fee numeric;
begin
  if p_provider is null or p_provider_ref is null then raise exception 'provider_required'; end if;
  -- el mismo aviso de pago puede llegar dos veces: no se duplica la compra ni las claves
  select id into v_id from public.purchases where provider_ref = p_provider_ref;
  if found then return v_id; end if;
  if not exists (select 1 from public.plans where product_id = p_product_id and id = p_plan_id) then raise exception 'plan_not_found'; end if;

  select fee_percent into v_fee from public.gateway_fees where provider = p_provider;
  v_fee := coalesce(v_fee, 0);
  insert into public.purchases (user_id, product_id, plan_id, amount, discount_amount, coupon_id, currency, status,
                                provider, provider_ref, fee_percent, fee_amount, net_amount, paid_at)
  values (p_user_id, p_product_id, p_plan_id, p_amount, p_discount, p_coupon_id, p_currency, 'paid',
          p_provider, p_provider_ref, v_fee, round(p_amount * v_fee / 100, 2), p_amount - round(p_amount * v_fee / 100, 2), now())
  returning id into v_id;
  -- el pago ya se cobró: el uso del cupón se cuenta aunque se haya agotado mientras tanto
  if p_coupon_id is not null then
    update public.coupons set uses_count = uses_count + 1 where id = p_coupon_id;
  end if;
  return v_id;
end;
$fn$;

revoke execute on function public.checkout_quote(text, text, text) from public, anon;
revoke execute on function public.checkout_claim_free(text, text, text) from public, anon;
revoke execute on function public.confirm_purchase(uuid, uuid, text, numeric, text, text, numeric, uuid, text) from public, anon, authenticated;
grant execute on function public.checkout_quote(text, text, text) to authenticated;
grant execute on function public.checkout_claim_free(text, text, text) to authenticated;
grant execute on function public.confirm_purchase(uuid, uuid, text, numeric, text, text, numeric, uuid, text) to service_role;
