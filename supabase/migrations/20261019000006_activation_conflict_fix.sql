-- The RETURNS TABLE column `license_id` is a PL/pgSQL variable. Naming the
-- unique constraint avoids an ambiguous reference on first activation.
create or replace function public.claim_hyro_activation(
  p_key_hash bytea, p_device_hash bytea, p_ip_hash bytea
) returns table(outcome text, license_id uuid, activation_epoch integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_license public.licenses%rowtype;
  v_active public.license_activations%rowtype;
  v_attempt_id bigint;
begin
  if octet_length(p_key_hash) <> 32 or octet_length(p_device_hash) <> 32
     or octet_length(p_ip_hash) <> 32 then
    raise exception 'invalid activation input' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.encode(p_ip_hash, 'hex'), 0));
  if (select count(*) from public.activation_attempts a
      where a.ip_hash = p_ip_hash and a.attempted_at > now() - interval '15 minutes') >= 30
     or (select count(*) from public.activation_attempts a
      where a.key_hash = p_key_hash and a.attempted_at > now() - interval '15 minutes') >= 15 then
    return query select 'rate_limited'::text, null::uuid, null::integer;
    return;
  end if;
  insert into public.activation_attempts (ip_hash, key_hash)
    values (p_ip_hash, p_key_hash) returning id into v_attempt_id;
  select l.* into v_license from public.licenses l
    join public.orders o on o.id = l.order_id
    where l.key_hash = p_key_hash and l.status = 'active' and o.status = 'paid'
    for update of l;
  if not found then
    return query select 'invalid'::text, null::uuid, null::integer;
    return;
  end if;
  select * into v_active from public.license_activations a
    where a.license_id = v_license.id and a.deactivated_at is null for update;
  if found and v_active.device_hash <> p_device_hash then
    return query select 'device_limit'::text, null::uuid, null::integer;
    return;
  end if;
  if found then
    update public.license_activations a set last_seen_at = now() where a.id = v_active.id;
  else
    insert into public.license_activations
      (license_id, device_hash, activated_at, last_seen_at, deactivated_at)
      values (v_license.id, p_device_hash, now(), now(), null)
      on conflict on constraint license_activations_license_id_device_hash_key do update
        set activated_at = now(), last_seen_at = now(), deactivated_at = null;
  end if;
  update public.activation_attempts set accepted = true where id = v_attempt_id;
  return query select 'active'::text, v_license.id, v_license.activation_epoch;
end $$;
revoke all on function public.claim_hyro_activation(bytea,bytea,bytea)
  from public, anon, authenticated;
grant execute on function public.claim_hyro_activation(bytea,bytea,bytea)
  to service_role;
