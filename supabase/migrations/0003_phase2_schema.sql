-- Esquema de la Fase 2 del panel administrativo: moderación de reseñas y anuncios.
-- Ejecutar en Supabase (SQL Editor) sobre el proyecto "hyro-enterprise", después de 0002.

-- ---------------------------------------------------------------------------
-- moderación de reseñas
-- ---------------------------------------------------------------------------
alter table public.reviews add column hidden boolean not null default false;

drop policy "el usuario ve sus reseñas y las publicadas" on public.reviews;

create policy "el usuario ve sus reseñas y las publicadas" on public.reviews
  for select using (not hidden or auth.uid() = user_id or public.is_admin());

create policy "admins moderan reseñas" on public.reviews
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- anuncios
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'finished')),
  audience text not null default 'general' check (audience in ('general', 'buyers')),
  placement text not null default 'landing_banner' check (placement in ('landing_banner', 'library')),
  product_id uuid references public.products (id),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

create policy "admins administran anuncios" on public.announcements
  for all using (public.is_admin()) with check (public.is_admin());

create policy "anuncios publicados y vigentes son visibles" on public.announcements
  for select using (
    status = 'published'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and (
      audience = 'general'
      or (
        audience = 'buyers'
        and auth.uid() is not null
        and exists (
          select 1 from public.purchases
          where purchases.user_id = auth.uid()
            and purchases.status = 'paid'
            and (announcements.product_id is null or purchases.product_id = announcements.product_id)
        )
      )
    )
  );
