-- Versiones y actualizaciones: instaladores subidos a Cloudflare R2, publicación y reversión.
-- Ejecutar en Supabase (SQL Editor) sobre el proyecto "hyro-enterprise", después de 0003.

create table public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  version text not null,
  status text not null default 'draft' check (status in ('draft', 'ready', 'published', 'previous', 'failed')),
  changelog text not null default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (product_id, version)
);

create table public.product_installers (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.product_versions (id) on delete cascade,
  platform text not null check (platform in ('windows', 'macos')),
  object_key text not null,
  size_bytes bigint,
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'failed')),
  uploaded_at timestamptz,
  unique (version_id, platform)
);

create table public.product_version_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id),
  version_id uuid not null references public.product_versions (id),
  seen_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.product_versions enable row level security;
alter table public.product_installers enable row level security;
alter table public.product_version_reads enable row level security;

create policy "admins administran versiones" on public.product_versions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "las versiones publicadas son públicas" on public.product_versions
  for select using (status = 'published');

create policy "admins administran instaladores" on public.product_installers
  for all using (public.is_admin()) with check (public.is_admin());

create policy "el usuario administra sus propias lecturas de versión" on public.product_version_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
