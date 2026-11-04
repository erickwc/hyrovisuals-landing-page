-- Faltaba permiso de INSERT para admins en products/plans (solo había UPDATE):
-- sin esto, el botón "Nuevo producto"/"Nuevo plan" del panel fallaba por RLS.
create policy "admins crean productos" on public.products for insert with check (public.is_admin());
create policy "admins crean planes" on public.plans for insert with check (public.is_admin());
