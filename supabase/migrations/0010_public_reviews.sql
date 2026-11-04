-- ---------------------------------------------------------------------------
-- reseñas reales en la web y el cliente puede borrar la suya.
-- ---------------------------------------------------------------------------

-- el cliente borra su propia reseña desde su biblioteca
create policy "el usuario borra su propia reseña" on public.reviews
  for delete using (auth.uid() = user_id);

-- Reseñas publicadas (no ocultas por un admin) para la sección de la web, con un nombre corto
-- del autor: el primer nombre y la inicial del apellido ("Erick C."). Nunca expone el correo ni el id.
-- profiles solo lo lee su dueño, por eso la función es security definer y devuelve solo estas columnas.
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
  order by r.created_at desc;
$$;

revoke all on function public.public_reviews() from public;
grant execute on function public.public_reviews() to anon, authenticated;
