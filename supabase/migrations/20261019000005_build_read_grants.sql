-- Build ownership policy reads these relations as the authenticated buyer.
-- Grant only the columns needed by the storefront and policy; RLS still
-- confines both relations to the buyer's own rows.
grant select (id, user_id, product_id, order_id, status)
  on public.licenses to authenticated;
grant select (id, user_id, status)
  on public.orders to authenticated;
