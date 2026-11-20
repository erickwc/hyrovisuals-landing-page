-- ---------------------------------------------------------------------------
-- Endurecimiento de seguridad (revisión de las 20 recomendaciones antes de lanzar).
--   1. Perfiles: el usuario solo cambia su nombre y su foto (no el correo, el id ni la fecha).
--   2. Reseñas: el usuario no puede quitarse la ocultación de un admin ni mover la reseña a otra cuenta o producto.
--   3. Fotos de perfil: máximo 5 MB y solo JPG o PNG (antes el bucket aceptaba cualquier archivo y tamaño).
--   4. Newsletter: se suscribe con newsletter_subscribe(), que valida, guarda la autorización y limita a 5
--      suscripciones por hora y por IP (contra bots). Ya nadie inserta directo en la tabla.
--   5. record_consent: solo con sesión (sin sesión ya no se usa; la newsletter va por newsletter_subscribe).
--   6. public_reviews: devuelve como máximo 60 reseñas (respuestas acotadas).
-- ---------------------------------------------------------------------------

-- 1. perfiles
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- los cambios del servidor (service_role, disparadores de auth) y de los admins pasan igual
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- 2. reseñas
create or replace function public.reviews_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.hidden := false;
    return new;
  end if;
  new.user_id := old.user_id;
  new.product_id := old.product_id;
  new.hidden := old.hidden;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists reviews_guard on public.reviews;
create trigger reviews_guard before insert or update on public.reviews
  for each row execute function public.reviews_guard();

-- 3. fotos de perfil
update storage.buckets
set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png']
where id = 'avatars';

-- 4. newsletter con límite por IP
create or replace function public.newsletter_subscribe(p_email text, p_lang text, p_source text, p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_ip text := public.request_ip();
  v_source text := case when p_source = 'checkout' then 'checkout' else 'landing' end;
begin
  -- con sesión, siempre el correo de la cuenta
  if v_uid is not null then
    select lower(email) into v_email from auth.users where id = v_uid;
  else
    v_email := lower(trim(p_email));
  end if;
  if v_email is null or char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then
    raise exception 'invalid_email';
  end if;
  if v_ip is not null and (
    select count(*) from public.legal_consents
    where document = 'marketing' and ip = v_ip and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.legal_consents (user_id, email, document, version, accepted, source, ip, user_agent)
  select v_uid, v_email, d, left(coalesce(p_version, 'desconocida'), 20), true,
         case when v_source = 'checkout' then 'checkout' else 'newsletter' end, v_ip, public.request_user_agent()
  from unnest(case when v_uid is null then array['marketing', 'privacy'] else array['marketing'] end) as d;

  insert into public.newsletter_subscribers (email, lang, source)
  values (v_email, case when p_lang = 'en' then 'en' else 'es' end, v_source)
  on conflict (email) do nothing;
end;
$$;

revoke all on function public.newsletter_subscribe(text, text, text, text) from public;
grant execute on function public.newsletter_subscribe(text, text, text, text) to anon, authenticated;

drop policy if exists "cualquiera se suscribe al newsletter" on public.newsletter_subscribers;

-- 5. record_consent solo con sesión
revoke execute on function public.record_consent(text[], text, text, text, boolean) from anon;

-- 6. reseñas públicas acotadas
create or replace function public.public_reviews()
returns table (id uuid, rating smallint, comment text, created_at timestamptz, author text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.rating,
    r.comment,
    r.created_at,
    nullif(
      trim(
        split_part(trim(coalesce(p.name, '')), ' ', 1)
        || case
             when position(' ' in trim(coalesce(p.name, ''))) > 0
               then ' ' || upper(left(regexp_replace(trim(p.name), '^.*\s', ''), 1)) || '.'
             else ''
           end
      ),
      ''
    ) as author,
    p.avatar_url
  from public.reviews r
  left join public.profiles p on p.id = r.user_id
  where not r.hidden
  order by r.created_at desc
  limit 60;
$$;

-- 7. funciones con search_path fijo (aviso del asesor de seguridad de Supabase)
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('set_updated_at', 'handle_purchase_paid', 'is_admin', 'admin_create_settlement',
                        'admin_publish_version', 'normalize_license_key', 'redeem_coupon', 'request_ip', 'request_user_agent')
  loop
    execute format('alter function %s set search_path = public', f);
  end loop;
end;
$$;

-- 8. funciones de disparadores: no se llaman por la API (los disparadores siguen funcionando igual)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.record_signup_consent() from public, anon, authenticated;
revoke execute on function public.profiles_guard() from public, anon, authenticated;
revoke execute on function public.reviews_guard() from public, anon, authenticated;

-- 9. funciones que solo tienen sentido con sesión
revoke execute on function public.newsletter_unsubscribe_me() from public, anon;
grant execute on function public.newsletter_unsubscribe_me() to authenticated;
revoke execute on function public.my_purchase_coupons() from public, anon;
grant execute on function public.my_purchase_coupons() to authenticated;
