-- Esquema del dashboard de clientes: planes, productos, compras, licencias y reseñas.
-- Ejecutar en Supabase (SQL Editor) sobre el proyecto "hyro-enterprise".

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- planes (espejo de `plans` en src/data/content.ts: cuántas claves trae cada uno)
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key,
  price_usd numeric(10, 2) not null,
  license_count int not null check (license_count > 0),
  active boolean not null default true
);

insert into public.plans (id, price_usd, license_count) values
  ('personal', 20, 1),
  ('equipos', 50, 3);

-- ---------------------------------------------------------------------------
-- productos
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  version text not null,
  image_path text not null default '',
  windows_url text,
  mac_url text,
  created_at timestamptz not null default now()
);

-- URLs de instaladores: reemplazar por las reales de Cloudflare antes de publicar.
insert into public.products (slug, name, version, image_path, windows_url, mac_url) values
  ('hyro-visuals', 'Hyro Visuals', '1.4.2', 'media/productos/hyro-visuals.jpg', null, null);

-- ---------------------------------------------------------------------------
-- compras (solo las escribe el servidor: confirm_purchase al confirmarse un pago, o un pedido gratis con cupón)
-- ---------------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id),
  plan_id text not null references public.plans (id),
  provider_ref text unique, -- id de la transacción en la pasarela (evita registrar dos veces el mismo pago)
  amount numeric(10, 2) not null,
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  invoice_url text,
  created_at timestamptz not null default now()
);

create index purchases_user_id_idx on public.purchases (user_id);

-- ---------------------------------------------------------------------------
-- licencias (generadas automáticamente cuando una compra pasa a 'paid')
-- ---------------------------------------------------------------------------
create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id),
  plan_id text not null references public.plans (id),
  license_key text unique not null,
  created_at timestamptz not null default now()
);

create index licenses_user_id_idx on public.licenses (user_id);

-- ---------------------------------------------------------------------------
-- reseñas (una por usuario y producto; solo con compra pagada)
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id),
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- generación de claves al confirmarse el pago
-- ---------------------------------------------------------------------------
create or replace function public.generate_license_key()
returns text
language sql
as $$
  select 'HYRO-' || upper(
    encode(gen_random_bytes(2), 'hex') || '-' ||
    encode(gen_random_bytes(2), 'hex') || '-' ||
    encode(gen_random_bytes(2), 'hex')
  );
$$;

create or replace function public.handle_purchase_paid()
returns trigger
language plpgsql
as $$
declare
  n int;
  i int;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    select license_count into n from public.plans where id = new.plan_id;
    for i in 1..coalesce(n, 1) loop
      insert into public.licenses (purchase_id, user_id, product_id, plan_id, license_key)
      values (new.id, new.user_id, new.product_id, new.plan_id, public.generate_license_key());
    end loop;
  end if;
  return new;
end;
$$;

create trigger purchases_handle_paid
  after insert or update of status on public.purchases
  for each row execute function public.handle_purchase_paid();

-- ---------------------------------------------------------------------------
-- RLS: cada cliente solo ve lo suyo; compras/licencias las escribe el backend
-- (funciones del servidor), nunca el cliente.
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.licenses enable row level security;
alter table public.reviews enable row level security;

create policy "plans son públicos" on public.plans for select using (true);
create policy "products son públicos" on public.products for select using (true);

create policy "el usuario ve sus compras" on public.purchases
  for select using (auth.uid() = user_id);

create policy "el usuario ve sus licencias" on public.licenses
  for select using (auth.uid() = user_id);

create policy "el usuario ve sus reseñas y las publicadas" on public.reviews
  for select using (true);

create policy "el usuario escribe su propia reseña con compra pagada" on public.reviews
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.purchases
      where purchases.user_id = auth.uid()
        and purchases.product_id = reviews.product_id
        and purchases.status = 'paid'
    )
  );

create policy "el usuario edita su propia reseña" on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
