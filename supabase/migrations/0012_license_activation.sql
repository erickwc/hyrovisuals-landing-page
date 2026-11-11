-- Activación de licencias: claves con letras, números y símbolos (ej. 4#K7-A$U3-#894-ER14),
-- una activación por clave y por equipo, emisión manual desde /admin y liberación de equipos.
--
-- Quién escribe qué:
--   · La app de escritorio habla con la Edge Function `license-server`, que llama a las funciones
--     license_activate / license_status / license_deactivate con la llave de servicio (nunca el cliente).
--   · El cliente web solo lee sus licencias/activaciones (RLS) y libera un equipo con release_my_activation.
--   · El admin emite, revoca y libera con las funciones admin_* (comprueban is_admin()).

-- ---------------------------------------------------------------------------
-- formato de clave
-- ---------------------------------------------------------------------------
-- 16 caracteres en 4 grupos. Sin caracteres que se confunden (0/O, 1/I/L) ni el guion (es el separador).
-- Siempre lleva al menos una letra, un número y un símbolo. ~82 bits de azar: no se puede adivinar.
create or replace function public.generate_license_key()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $fn$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789#$%@&';
  n constant int := 36;
  bytes bytea;
  raw text;
  b int;
  i int;
  candidate text;
begin
  loop
    bytes := gen_random_bytes(40);
    raw := '';
    for i in 0..39 loop
      b := get_byte(bytes, i);
      -- muestreo por rechazo: 252 = 36 * 7, así cada carácter tiene la misma probabilidad
      if b < 252 then raw := raw || substr(alphabet, (b % n) + 1, 1); end if;
      exit when length(raw) = 16;
    end loop;
    continue when length(raw) < 16;
    continue when raw !~ '[A-Z]' or raw !~ '[0-9]' or raw !~ '[#$%@&]';
    candidate := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4) || '-' || substr(raw, 13, 4);
    if not exists (select 1 from public.licenses where license_key = candidate) then
      return candidate;
    end if;
  end loop;
end;
$fn$;

-- Lo que escribe la persona → forma canónica (mayúsculas, sin espacios, guiones cada 4).
create or replace function public.normalize_license_key(p_key text)
returns text
language sql
immutable
as $fn$
  select case
    when length(c) = 16 then substr(c, 1, 4) || '-' || substr(c, 5, 4) || '-' || substr(c, 9, 4) || '-' || substr(c, 13, 4)
    else upper(trim(coalesce(p_key, '')))
  end
  from (select upper(regexp_replace(coalesce(p_key, ''), '[[:space:]-]', '', 'g')) as c) s;
$fn$;

-- ---------------------------------------------------------------------------
-- licencias: estado, origen y emisión manual
-- ---------------------------------------------------------------------------
alter table public.licenses alter column purchase_id drop not null;
alter table public.licenses
  add column if not exists status text not null default 'active' check (status in ('active', 'revoked')),
  add column if not exists source text not null default 'purchase' check (source in ('purchase', 'manual')),
  add column if not exists note text,
  add column if not exists revoked_at timestamptz,
  add column if not exists issued_by uuid references auth.users (id);

-- Las claves de prueba que ya existían tenían el formato viejo HYRO-XXXX-XXXX-XXXX: se reemplazan.
update public.licenses set license_key = public.generate_license_key() where license_key like 'HYRO-%';

-- El trigger buscaba el plan solo por id; desde 0006 el plan se identifica por (producto, id).
create or replace function public.handle_purchase_paid()
returns trigger
language plpgsql
as $fn$
declare
  n int;
  i int;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    -- No duplicar claves si una compra vuelve a 'paid' (p. ej. tras corregirla a mano).
    if exists (select 1 from public.licenses where purchase_id = new.id) then return new; end if;
    select license_count into n from public.plans where id = new.plan_id and product_id = new.product_id;
    for i in 1..coalesce(n, 1) loop
      insert into public.licenses (purchase_id, user_id, product_id, plan_id, license_key, source)
      values (new.id, new.user_id, new.product_id, new.plan_id, public.generate_license_key(), 'purchase');
    end loop;
  end if;
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- activaciones (una clave = un equipo a la vez; un equipo = una clave por producto)
-- ---------------------------------------------------------------------------
create table if not exists public.license_activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses (id) on delete cascade,
  product_id uuid not null references public.products (id),
  device_id text not null check (length(device_id) between 16 and 128),
  token_hash text not null,
  device_name text,
  platform text,
  app_version text,
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  released_at timestamptz,
  released_by text check (released_by in ('device', 'customer', 'admin', 'revoked'))
);
create unique index if not exists license_activations_one_device_per_key
  on public.license_activations (license_id) where released_at is null;
create unique index if not exists license_activations_one_key_per_device
  on public.license_activations (product_id, device_id) where released_at is null;
create index if not exists license_activations_license_idx on public.license_activations (license_id);

alter table public.license_activations enable row level security;
create policy "el usuario ve las activaciones de sus licencias" on public.license_activations
  for select using (exists (select 1 from public.licenses l where l.id = license_id and l.user_id = auth.uid()));
create policy "admins ven todas las activaciones" on public.license_activations
  for select using (public.is_admin());
-- El hash del token y el id del equipo no salen del servidor.
revoke select on public.license_activations from anon, authenticated;
grant select (id, license_id, product_id, device_name, platform, app_version, activated_at, last_seen_at, released_at, released_by)
  on public.license_activations to authenticated;

-- Intentos de la app (para frenar a quien pruebe claves al azar). Solo el servidor lee/escribe.
create table if not exists public.license_attempts (
  id bigint generated always as identity primary key,
  device_id text,
  ip text,
  action text not null,
  ok boolean not null,
  code text,
  at timestamptz not null default now()
);
create index if not exists license_attempts_recent_idx on public.license_attempts (at);
alter table public.license_attempts enable row level security;
create policy "admins leen intentos de licencia" on public.license_attempts for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- funciones del servidor de licencias (solo service_role)
-- ---------------------------------------------------------------------------
create or replace function public.license_log_attempt(p_device text, p_ip text, p_action text, p_ok boolean, p_code text)
returns void
language sql
security definer
set search_path = public
as $fn$
  insert into public.license_attempts (device_id, ip, action, ok, code) values (p_device, p_ip, p_action, p_ok, p_code);
$fn$;

create or replace function public.license_throttled(p_device text, p_ip text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- limpieza ocasional
  if random() < 0.02 then delete from public.license_attempts where at < now() - interval '2 days'; end if;
  return (select count(*) from public.license_attempts
          where not ok and code = 'invalid_license' and at > now() - interval '15 minutes'
            and (device_id = p_device or (p_ip is not null and ip = p_ip))) >= 10;
end;
$fn$;

-- Licencia usable: activa y, si viene de una compra, la compra sigue pagada (un reembolso la apaga).
create or replace function public.license_find(p_key text)
returns table (license_id uuid, product_id uuid, product_slug text, usable boolean)
language sql
stable
security definer
set search_path = public
as $fn$
  select l.id, l.product_id, p.slug,
         l.status = 'active' and (l.purchase_id is null or coalesce(pu.status, '') = 'paid')
  from public.licenses l
  join public.products p on p.id = l.product_id
  left join public.purchases pu on pu.id = l.purchase_id
  where l.license_key = public.normalize_license_key(p_key);
$fn$;

create or replace function public.license_activate(
  p_key text, p_device text, p_token_hash text, p_product text,
  p_device_name text default null, p_platform text default null, p_version text default null, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  lic record;
  current_act public.license_activations;
begin
  if public.license_throttled(p_device, p_ip) then return jsonb_build_object('error', 'rate_limited'); end if;

  select * into lic from public.license_find(p_key);
  if not found or not lic.usable or lic.product_slug <> p_product then
    perform public.license_log_attempt(p_device, p_ip, 'activate', false, 'invalid_license');
    return jsonb_build_object('error', 'invalid_license');
  end if;

  -- Serializa activaciones simultáneas de la misma clave.
  perform 1 from public.licenses where id = lic.license_id for update;

  select * into current_act from public.license_activations
   where license_id = lic.license_id and released_at is null;

  if found then
    if current_act.device_id <> p_device then
      perform public.license_log_attempt(p_device, p_ip, 'activate', false, 'already_bound');
      return jsonb_build_object('error', 'already_bound');
    end if;
    -- Mismo equipo (reinstalación, datos locales perdidos): se renueva el token.
    update public.license_activations
       set token_hash = p_token_hash, last_seen_at = now(),
           device_name = coalesce(p_device_name, device_name), platform = coalesce(p_platform, platform),
           app_version = coalesce(p_version, app_version)
     where id = current_act.id;
  else
    if exists (select 1 from public.license_activations
               where product_id = lic.product_id and device_id = p_device and released_at is null) then
      perform public.license_log_attempt(p_device, p_ip, 'activate', false, 'device_occupied');
      return jsonb_build_object('error', 'device_occupied');
    end if;
    begin
      insert into public.license_activations (license_id, product_id, device_id, token_hash, device_name, platform, app_version)
      values (lic.license_id, lic.product_id, p_device, p_token_hash, p_device_name, p_platform, p_version);
    exception when unique_violation then
      return jsonb_build_object('error', 'already_bound');
    end;
  end if;

  perform public.license_log_attempt(p_device, p_ip, 'activate', true, null);
  return jsonb_build_object('active', true);
end;
$fn$;

create or replace function public.license_status(
  p_key text, p_device text, p_token_hash text, p_product text, p_version text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  lic record;
  act_id uuid;
begin
  -- Sin el token de un equipo que la tuvo activada, la respuesta es siempre la misma: así /status no sirve
  -- para averiguar si una clave existe (eso solo se puede intentar por /activate, que limita los intentos).
  select * into lic from public.license_find(p_key);
  if not found or lic.product_slug <> p_product then return jsonb_build_object('error', 'device_not_authorized'); end if;
  if not lic.usable then
    if exists (select 1 from public.license_activations
               where license_id = lic.license_id and device_id = p_device and token_hash = p_token_hash) then
      return jsonb_build_object('error', 'invalid_license'); -- revocada o reembolsada: este equipo sí la tenía
    end if;
    return jsonb_build_object('error', 'device_not_authorized');
  end if;
  update public.license_activations
     set last_seen_at = now(), app_version = coalesce(p_version, app_version)
   where license_id = lic.license_id and released_at is null
     and device_id = p_device and token_hash = p_token_hash
  returning id into act_id;
  if act_id is null then return jsonb_build_object('error', 'device_not_authorized'); end if;
  return jsonb_build_object('active', true);
end;
$fn$;

create or replace function public.license_deactivate(p_key text, p_device text, p_token_hash text, p_product text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  lic record;
  act_id uuid;
begin
  select * into lic from public.license_find(p_key);
  if not found or lic.product_slug <> p_product then return jsonb_build_object('error', 'device_not_authorized'); end if;
  update public.license_activations
     set released_at = now(), released_by = 'device'
   where license_id = lic.license_id and released_at is null
     and device_id = p_device and token_hash = p_token_hash
  returning id into act_id;
  if act_id is null then return jsonb_build_object('error', 'device_not_authorized'); end if;
  return jsonb_build_object('active', false);
end;
$fn$;

-- Llave privada Ed25519 de los comprobantes sin conexión (guardada en Supabase Vault).
create or replace function public.license_signing_key()
returns text
language sql
stable
security definer
set search_path = public, vault
as $fn$
  select decrypted_secret from vault.decrypted_secrets where name = 'license_offline_private_key' limit 1;
$fn$;

revoke execute on function public.license_log_attempt(text, text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.license_throttled(text, text) from public, anon, authenticated;
revoke execute on function public.license_find(text) from public, anon, authenticated;
revoke execute on function public.license_activate(text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.license_status(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.license_deactivate(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.license_signing_key() from public, anon, authenticated;
-- generate_license_key queda ejecutable: el trigger de compras corre con el rol de quien marca la compra pagada.
grant execute on function public.license_activate(text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.license_status(text, text, text, text, text) to service_role;
grant execute on function public.license_deactivate(text, text, text, text) to service_role;
grant execute on function public.license_signing_key() to service_role;

-- ---------------------------------------------------------------------------
-- cliente: liberar un equipo desde /cuenta (p. ej. una computadora que ya no tiene)
-- ---------------------------------------------------------------------------
create or replace function public.release_my_activation(p_activation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  lic_id uuid;
begin
  select a.license_id into lic_id
    from public.license_activations a
    join public.licenses l on l.id = a.license_id
   where a.id = p_activation_id and a.released_at is null and l.user_id = auth.uid();
  if lic_id is null then raise exception 'activation_not_found'; end if;
  -- Evita "turnarse" una misma clave entre varias personas.
  if (select count(*) from public.license_activations
       where license_id = lic_id and released_by = 'customer' and released_at > now() - interval '30 days') >= 5 then
    raise exception 'release_limit';
  end if;
  update public.license_activations set released_at = now(), released_by = 'customer' where id = p_activation_id;
end;
$fn$;
revoke execute on function public.release_my_activation(uuid) from public, anon;
grant execute on function public.release_my_activation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- admin: emitir, revocar/reactivar y liberar
-- ---------------------------------------------------------------------------
-- Emite tantas claves como dice el plan (license_count), sin compra asociada.
create or replace function public.admin_issue_licenses(p_user_id uuid, p_product_id uuid, p_plan_id text, p_note text default null)
returns setof public.licenses
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n int;
  i int;
  rec public.licenses;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'user_not_found'; end if;
  select license_count into n from public.plans where product_id = p_product_id and id = p_plan_id;
  if n is null then raise exception 'plan_not_found'; end if;
  for i in 1..n loop
    insert into public.licenses (user_id, product_id, plan_id, license_key, source, note, issued_by)
    values (p_user_id, p_product_id, p_plan_id, public.generate_license_key(), 'manual', nullif(trim(p_note), ''), auth.uid())
    returning * into rec;
    return next rec;
  end loop;
  insert into public.admin_audit_log (admin_id, action, entity, entity_id, detail)
  values (auth.uid(), 'issue_licenses', 'user', p_user_id::text,
          jsonb_build_object('productId', p_product_id, 'planId', p_plan_id, 'count', n, 'note', p_note));
end;
$fn$;

create or replace function public.admin_set_license_status(p_license_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('active', 'revoked') then raise exception 'invalid_status'; end if;
  update public.licenses
     set status = p_status, revoked_at = case when p_status = 'revoked' then now() else null end
   where id = p_license_id;
  if not found then raise exception 'license_not_found'; end if;
  -- Revocar saca de inmediato al equipo que la usa (en la próxima verificación, ≤ 30 s).
  if p_status = 'revoked' then
    update public.license_activations set released_at = now(), released_by = 'revoked'
     where license_id = p_license_id and released_at is null;
  end if;
  insert into public.admin_audit_log (admin_id, action, entity, entity_id, detail)
  values (auth.uid(), case when p_status = 'revoked' then 'revoke_license' else 'restore_license' end, 'license', p_license_id::text, null);
end;
$fn$;

create or replace function public.admin_release_activation(p_activation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.license_activations set released_at = now(), released_by = 'admin'
   where id = p_activation_id and released_at is null;
  if not found then raise exception 'activation_not_found'; end if;
  insert into public.admin_audit_log (admin_id, action, entity, entity_id, detail)
  values (auth.uid(), 'release_activation', 'license_activation', p_activation_id::text, null);
end;
$fn$;

revoke execute on function public.admin_issue_licenses(uuid, uuid, text, text) from public, anon;
revoke execute on function public.admin_set_license_status(uuid, text) from public, anon;
revoke execute on function public.admin_release_activation(uuid) from public, anon;
grant execute on function public.admin_issue_licenses(uuid, uuid, text, text) to authenticated;
grant execute on function public.admin_set_license_status(uuid, text) to authenticated;
grant execute on function public.admin_release_activation(uuid) to authenticated;
