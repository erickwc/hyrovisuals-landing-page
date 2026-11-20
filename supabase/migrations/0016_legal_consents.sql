-- ---------------------------------------------------------------------------
-- Registro de consentimientos (Ley 1581 de 2012 y Decreto 1377 de 2013, art. 7: la autorización debe poder
-- probarse). Una fila por documento aceptado: quién (usuario y correo), qué (documento y versión), dónde
-- (formulario), cuándo (hora del servidor) y desde dónde (IP y navegador).
-- La tabla solo crece: nadie la edita ni la borra desde la web (ni los admins); se escribe con record_consent()
-- o con el disparador del registro, y la leen el propio usuario y los admins.
-- ---------------------------------------------------------------------------

create table if not exists public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  -- sin "on delete cascade": si se borra la cuenta, la prueba de la autorización se conserva
  user_id uuid references auth.users (id) on delete set null,
  email text not null check (char_length(email) <= 254),
  document text not null check (document in ('terms', 'privacy', 'marketing')),
  version text not null check (char_length(version) <= 20),
  accepted boolean not null default true,
  source text not null check (source in ('register', 'checkout', 'newsletter', 'account', 'unsubscribe')),
  ip text,
  user_agent text check (char_length(user_agent) <= 400),
  created_at timestamptz not null default now()
);

create index if not exists legal_consents_user_idx on public.legal_consents (user_id, created_at desc);
create index if not exists legal_consents_email_idx on public.legal_consents (lower(email), created_at desc);

alter table public.legal_consents enable row level security;

drop policy if exists "el usuario lee sus consentimientos" on public.legal_consents;
create policy "el usuario lee sus consentimientos" on public.legal_consents
  for select using (auth.uid() = user_id);

drop policy if exists "admins leen los consentimientos" on public.legal_consents;
create policy "admins leen los consentimientos" on public.legal_consents
  for select using (public.is_admin());

-- IP y navegador de la petición actual (PostgREST pasa las cabeceras; Cloudflare manda cf-connecting-ip)
create or replace function public.request_ip()
returns text
language sql
stable
as $$
  select nullif(coalesce(
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
    split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)
  ), '')
$$;

create or replace function public.request_user_agent()
returns text
language sql
stable
as $$
  select left(current_setting('request.headers', true)::json ->> 'user-agent', 400)
$$;

-- Anota uno o varios documentos aceptados (o rechazados, accepted = false) por quien hace la petición.
-- Con sesión se usan su id y su correo; sin sesión (newsletter de la landing) hace falta p_email.
create or replace function public.record_consent(
  p_documents text[],
  p_version text,
  p_source text,
  p_email text default null,
  p_accepted boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is not null then
    select lower(email) into v_email from auth.users where id = v_uid;
  else
    v_email := lower(trim(p_email));
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then
    raise exception 'consent_email_required';
  end if;
  if coalesce(array_length(p_documents, 1), 0) = 0 or array_length(p_documents, 1) > 3 then
    raise exception 'consent_documents_required';
  end if;
  -- sin sesión solo se puede aceptar lo del newsletter (no se firma nada a nombre de otra cuenta)
  if v_uid is null and p_source not in ('newsletter', 'unsubscribe') then
    raise exception 'consent_session_required';
  end if;

  insert into public.legal_consents (user_id, email, document, version, accepted, source, ip, user_agent)
  select v_uid, v_email, d, p_version, p_accepted, p_source, public.request_ip(), public.request_user_agent()
  from unnest(p_documents) as d;
end;
$$;

revoke all on function public.record_consent(text[], text, text, text, boolean) from public;
grant execute on function public.record_consent(text[], text, text, text, boolean) to anon, authenticated;

-- Registro: la web manda en los metadatos de signUp { consent: { version, terms: true, privacy: true, user_agent } }.
-- Al crearse el usuario se anotan las dos aceptaciones con la hora del servidor (GoTrue no pasa la IP aquí).
create or replace function public.record_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb := new.raw_user_meta_data -> 'consent';
begin
  if c is null then return new; end if;
  insert into public.legal_consents (user_id, email, document, version, accepted, source, user_agent)
  select new.id, lower(new.email), d, coalesce(c ->> 'version', 'desconocida'), true, 'register', left(c ->> 'user_agent', 400)
  from unnest(array['terms', 'privacy']) as d
  where c ->> d = 'true';
  return new;
end;
$$;

drop trigger if exists on_auth_user_consent on auth.users;
create trigger on_auth_user_consent
  after insert on auth.users
  for each row execute function public.record_signup_consent();

-- ---------------------------------------------------------------------------
-- Newsletter: enlace de baja en cada correo (https://byhyro.com/baja?t=<token>) que funciona sin iniciar sesión.
-- ---------------------------------------------------------------------------
alter table public.newsletter_subscribers
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists newsletter_unsubscribe_token_key on public.newsletter_subscribers (unsubscribe_token);

create or replace function public.newsletter_unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  delete from public.newsletter_subscribers where unsubscribe_token = p_token returning email into v_email;
  if v_email is null then return false; end if;
  -- queda constancia de que retiró la autorización
  insert into public.legal_consents (email, document, version, accepted, source, ip, user_agent)
  values (v_email, 'marketing', 'baja', false, 'unsubscribe', public.request_ip(), public.request_user_agent());
  return true;
end;
$$;

revoke all on function public.newsletter_unsubscribe(uuid) from public;
grant execute on function public.newsletter_unsubscribe(uuid) to anon, authenticated;

-- El usuario con sesión también puede darse de baja desde su cuenta
create or replace function public.newsletter_unsubscribe_me()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then raise exception 'not_authenticated'; end if;
  delete from public.newsletter_subscribers where email = v_email;
  insert into public.legal_consents (user_id, email, document, version, accepted, source, ip, user_agent)
  values (auth.uid(), v_email, 'marketing', 'baja', false, 'account', public.request_ip(), public.request_user_agent());
end;
$$;

revoke all on function public.newsletter_unsubscribe_me() from public;
grant execute on function public.newsletter_unsubscribe_me() to authenticated;
