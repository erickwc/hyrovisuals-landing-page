-- PayPal como forma de pago y aviso por correo de cada venta.
--
--   payment_methods      qué formas de pago ve el checkout; el panel admin las prende y apaga
--   paypal_orders        pedidos creados en PayPal (solo la función paypal los lee y escribe)
--   sale_notifications   a quién se le avisa por correo de cada venta (singleton, solo admins)
--   purchases.notified_at  el aviso de una venta sale una sola vez
--
-- Las credenciales de PayPal y del correo NO van en la base: son secretos de Edge Functions
-- (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV, RESEND_API_KEY, SALE_EMAIL_FROM).

create table if not exists public.payment_methods (
  provider text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.payment_methods enable row level security;
create policy "todos ven las formas de pago" on public.payment_methods for select using (true);
create policy "admins prenden y apagan formas de pago" on public.payment_methods
  for update using (public.is_admin()) with check (public.is_admin());
-- apagado hasta que las credenciales estén cargadas y un admin lo encienda
insert into public.payment_methods (provider, enabled) values ('paypal', false) on conflict do nothing;

create table if not exists public.paypal_orders (
  id text primary key,                       -- id del pedido en PayPal
  user_id uuid not null references auth.users (id),
  product_id uuid not null references public.products (id),
  plan_id text not null,
  amount numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  coupon_id uuid references public.coupons (id),
  status text not null default 'created' check (status in ('created', 'completed', 'failed')),
  purchase_id uuid references public.purchases (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.paypal_orders enable row level security;
-- sin políticas: solo la llave de servicio (función paypal) entra
create index if not exists paypal_orders_user_idx on public.paypal_orders (user_id);

create table if not exists public.sale_notifications (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  emails text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.sale_notifications enable row level security;
create policy "admins leen avisos de venta" on public.sale_notifications for select using (public.is_admin());
create policy "admins editan avisos de venta" on public.sale_notifications
  for update using (public.is_admin()) with check (public.is_admin());

-- de entrada, el aviso les llega a los administradores
insert into public.sale_notifications (id, emails)
select true, coalesce(array_agg(u.email order by a.created_at), '{}')
from public.admin_users a join auth.users u on u.id = a.user_id
on conflict (id) do nothing;

alter table public.purchases add column if not exists notified_at timestamptz;

-- la función paypal registra el pago confirmado con la llave de servicio
grant execute on function public.confirm_purchase(uuid, uuid, text, numeric, text, text, numeric, uuid, text) to service_role;
