-- Un cupón puede limitarse a una licencia (plan) de su producto. Sin plan_id sirve para todas.
alter table public.coupons
  add column plan_id text,
  add constraint coupons_plan_fkey foreign key (product_id, plan_id) references public.plans (product_id, id),
  add constraint coupons_plan_needs_product check (plan_id is null or product_id is not null);

-- PayPal y los pedidos gratis calculan el total aquí, así que esta es la validación que cuenta.
create or replace function public.checkout_quote(p_product_slug text, p_plan_id text, p_coupon text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
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
    if v_coupon.plan_id is not null and v_coupon.plan_id <> v_plan.id then
      return jsonb_build_object('error', 'Cupón no válido para esta licencia');
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
$function$;
