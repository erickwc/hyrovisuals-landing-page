-- ---------------------------------------------------------------------------
-- el cliente ve el código del cupón que usó en cada compra (en Compras y en su factura).
-- La tabla coupons solo la leen los admins, así que esta función devuelve únicamente el código,
-- y solo de las compras del usuario que la llama.
-- ---------------------------------------------------------------------------
create or replace function public.my_purchase_coupons()
returns table (purchase_id uuid, code text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, c.code
  from public.purchases p
  join public.coupons c on c.id = p.coupon_id
  where p.user_id = auth.uid();
$$;

revoke all on function public.my_purchase_coupons() from public;
grant execute on function public.my_purchase_coupons() to authenticated;
