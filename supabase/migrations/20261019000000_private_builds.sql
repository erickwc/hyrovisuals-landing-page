-- Keep R2 object names private and authorize builds through an active purchase.
create table if not exists public.product_builds (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  platform text not null check (platform in ('windows', 'macos')),
  version text not null check (length(version) between 1 and 50),
  object_key text not null unique check (length(object_key) between 1 and 512),
  file_name text not null check (file_name ~ '^[A-Za-z0-9._-]+$'),
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, platform, version)
);
create index if not exists product_builds_product_platform_idx
  on public.product_builds(product_id, platform) where is_active;
alter table public.product_builds enable row level security;
revoke all on public.product_builds from anon, authenticated;
grant select on public.product_builds to authenticated;
create policy product_builds_owned_read on public.product_builds for select to authenticated
  using (is_active and exists (
    select 1 from public.licenses l
    join public.orders o on o.id = l.order_id
    where l.product_id = product_builds.product_id
      and l.user_id = (select auth.uid())
      and l.status = 'active' and o.status = 'paid'
  ));

insert into public.product_builds
  (product_id, platform, version, object_key, file_name, size_bytes, sha256, is_active)
select id, 'windows', '0.2.4', 'hyro-visuals-0.2.4-win-x64.exe',
  'hyro-visuals-0.2.4-win-x64.exe', 117292289,
  '61e580f3e6de9fa401972c8077d2b9ce2751a2afd403d874e59c29929699d99c', true
from public.products where slug = 'hyro-visuals'
on conflict (product_id, platform, version) do update
set object_key = excluded.object_key, file_name = excluded.file_name,
    size_bytes = excluded.size_bytes, sha256 = excluded.sha256, is_active = excluded.is_active;
