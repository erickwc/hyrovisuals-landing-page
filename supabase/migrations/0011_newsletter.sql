-- ---------------------------------------------------------------------------
-- Newsletter de la landing (formulario «Suscríbete» del footer).
-- Cualquier visitante puede suscribirse (solo insertar); la lista solo la leen y borran los admins.
-- La landing inserta sin pedir la fila de vuelta (Prefer: return=minimal), así no necesita permiso de lectura.
-- Un correo repetido choca con el índice único y la landing lo toma como «ya estabas suscrito».
-- ---------------------------------------------------------------------------

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  lang text not null default 'es' check (lang in ('es', 'en')),
  source text not null default 'landing' check (char_length(source) <= 40),
  created_at timestamptz not null default now(),
  constraint newsletter_email_valido check (
    char_length(email) <= 254
    and email = lower(email)
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'
  )
);

create unique index newsletter_subscribers_email_key on public.newsletter_subscribers (email);

alter table public.newsletter_subscribers enable row level security;

create policy "cualquiera se suscribe al newsletter" on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);

create policy "admins leen el newsletter" on public.newsletter_subscribers
  for select using (public.is_admin());

create policy "admins borran del newsletter" on public.newsletter_subscribers
  for delete using (public.is_admin());
