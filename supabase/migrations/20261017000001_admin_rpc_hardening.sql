-- Keep privileged code outside schemas exposed by PostgREST.
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create or replace function app_private.admin_list_customers()
returns table (
  customer_id uuid,
  display_name text,
  email text,
  role text,
  created_at timestamptz,
  purchases jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles administrator
    where administrator.id = (select auth.uid())
      and administrator.role = 'admin'
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    p.id, p.display_name, u.email::text, p.role, p.created_at,
    coalesce(purchased.items, '[]'::jsonb)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'order_id', o.id,
        'product_name', product.name,
        'paid_at', o.paid_at,
        'amount_cents', item.unit_price_cents,
        'currency', item.currency
      ) order by o.paid_at desc, item.created_at desc
    ) as items
    from public.orders o
    join public.order_items item on item.order_id = o.id
    join public.products product on product.id = item.product_id
    where o.user_id = p.id and o.status = 'paid'
  ) purchased on true
  order by p.created_at desc;
end;
$$;

create or replace function app_private.admin_set_customer_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize role changes so one administrator always remains.
  perform pg_catalog.pg_advisory_xact_lock(738274, 1);

  if not exists (
    select 1 from public.profiles administrator
    where administrator.id = (select auth.uid())
      and administrator.role = 'admin'
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if new_role not in ('customer', 'admin') or new_role is null then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  if target_user_id = (select auth.uid()) then
    raise exception 'An administrator cannot change their own role' using errcode = '22023';
  end if;

  update public.profiles p
  set role = new_role, updated_at = now()
  where p.id = target_user_id;

  if not found then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function app_private.admin_list_customers() from public, anon;
revoke all on function app_private.admin_set_customer_role(uuid, text) from public, anon;
grant execute on function app_private.admin_list_customers() to authenticated;
grant execute on function app_private.admin_set_customer_role(uuid, text) to authenticated;

create or replace function public.admin_list_customers()
returns table (
  customer_id uuid,
  display_name text,
  email text,
  role text,
  created_at timestamptz,
  purchases jsonb
)
language sql
security invoker
set search_path = ''
as $$ select * from app_private.admin_list_customers(); $$;

create or replace function public.admin_set_customer_role(
  target_user_id uuid,
  new_role text
)
returns void
language sql
security invoker
set search_path = ''
as $$ select app_private.admin_set_customer_role(target_user_id, new_role); $$;

revoke all on function public.admin_list_customers() from public, anon;
revoke all on function public.admin_set_customer_role(uuid, text) from public, anon;
grant execute on function public.admin_list_customers() to authenticated;
grant execute on function public.admin_set_customer_role(uuid, text) to authenticated;
