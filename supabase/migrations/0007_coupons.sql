-- Cupones de descuento: código, tipo (% o monto fijo), alcance opcional a un producto,
-- límite de usos opcional y vencimiento opcional.

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  product_id uuid references public.products (id),
  max_uses int,
  uses_count int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.purchases
  add column coupon_id uuid references public.coupons (id),
  add column discount_amount numeric(10, 2);

alter table public.coupons enable row level security;

create policy "admins administran cupones" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());

-- Valida y marca un uso del cupón de forma atómica. Lo llama el webhook al confirmar el pago,
-- nunca el cliente directo (no hay policy pública de lectura sobre coupons).
create or replace function public.redeem_coupon(p_code text, p_product_id uuid)
returns public.coupons
language plpgsql
as $$
declare
  v_coupon public.coupons;
begin
  select * into v_coupon from public.coupons where code = upper(p_code) for update;

  if v_coupon is null then
    raise exception 'Cupón inválido';
  end if;
  if not v_coupon.active then
    raise exception 'Cupón inactivo';
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    raise exception 'Cupón vencido';
  end if;
  if v_coupon.max_uses is not null and v_coupon.uses_count >= v_coupon.max_uses then
    raise exception 'Cupón agotado';
  end if;
  if v_coupon.product_id is not null and v_coupon.product_id <> p_product_id then
    raise exception 'Cupón no válido para este producto';
  end if;

  update public.coupons set uses_count = uses_count + 1 where id = v_coupon.id
    returning * into v_coupon;

  return v_coupon;
end;
$$;
