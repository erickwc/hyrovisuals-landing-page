-- Publicar (o revertir a) una versión: atómico, como admin_create_settlement en 0002.
create or replace function public.admin_publish_version(p_version_id uuid)
returns public.product_versions
language plpgsql
as $$
declare
  v_version public.product_versions;
  v_has_installer boolean;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede publicar una versión';
  end if;

  select exists (
    select 1 from public.product_installers
    where version_id = p_version_id and status = 'uploaded'
  ) into v_has_installer;
  if not v_has_installer then
    raise exception 'La versión necesita al menos un instalador subido antes de publicarse';
  end if;

  update public.product_versions set status = 'previous'
    where product_id = (select product_id from public.product_versions where id = p_version_id)
      and status = 'published';

  update public.product_versions
    set status = 'published', published_at = now()
    where id = p_version_id
    returning * into v_version;

  update public.products set version = v_version.version where id = v_version.product_id;

  return v_version;
end;
$$;
