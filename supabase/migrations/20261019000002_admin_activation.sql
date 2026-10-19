-- Keep the existing customer list shape while adding license state for support.
create or replace function app_private.admin_list_customers()
returns table (
  customer_id uuid, display_name text, email text, role text,
  created_at timestamptz, purchases jsonb
) language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles administrator
    where administrator.id = (select auth.uid()) and administrator.role = 'admin') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  select p.id, p.display_name, u.email::text, p.role, p.created_at,
    coalesce(purchased.items, '[]'::jsonb)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'order_id', o.id,
      'product_name', product.name,
      'paid_at', o.paid_at,
      'amount_cents', item.unit_price_cents,
      'currency', item.currency,
      'license_id', l.id,
      'device_active', exists (
        select 1 from public.license_activations a
        where a.license_id = l.id and a.deactivated_at is null
      )
    ) order by o.paid_at desc, item.created_at desc) as items
    from public.orders o
    join public.order_items item on item.order_id = o.id
    join public.products product on product.id = item.product_id
    left join public.licenses l on l.order_item_id = item.id
    where o.user_id = p.id and o.status = 'paid'
  ) purchased on true
  order by p.created_at desc;
end $$;

create or replace function app_private.admin_transfer_license(
  p_license_id uuid, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 5 and 500 then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  perform 1 from public.licenses l where l.id = p_license_id for update;
  if not found then raise exception 'License not found' using errcode = 'P0002'; end if;
  update public.license_activations a set deactivated_at = now()
    where a.license_id = p_license_id and a.deactivated_at is null;
  update public.licenses l set activation_epoch = activation_epoch + 1
    where l.id = p_license_id;
  insert into public.license_transfer_audit (license_id, actor_id, reason)
    values (p_license_id, (select auth.uid()), trim(p_reason));
end $$;
revoke all on function app_private.admin_transfer_license(uuid,text) from public, anon;
grant execute on function app_private.admin_transfer_license(uuid,text) to authenticated;

create or replace function public.admin_transfer_license(
  p_license_id uuid, p_reason text
) returns void language sql security invoker set search_path = '' as $$
  select app_private.admin_transfer_license(p_license_id, p_reason);
$$;
revoke all on function public.admin_transfer_license(uuid,text) from public, anon;
grant execute on function public.admin_transfer_license(uuid,text) to authenticated;
