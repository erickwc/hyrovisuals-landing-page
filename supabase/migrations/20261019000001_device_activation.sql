-- A license can have only one live device, including under simultaneous requests.
alter table public.licenses
  add column if not exists activation_epoch integer not null default 0
  check (activation_epoch >= 0);
create unique index if not exists license_activations_one_live_device
  on public.license_activations(license_id) where deactivated_at is null;

create table if not exists public.activation_attempts (
  id bigint generated always as identity primary key,
  ip_hash bytea not null check (octet_length(ip_hash) = 32),
  key_hash bytea not null check (octet_length(key_hash) = 32),
  attempted_at timestamptz not null default now(),
  accepted boolean not null default false
);
create index if not exists activation_attempts_ip_recent_idx
  on public.activation_attempts(ip_hash, attempted_at desc);
create index if not exists activation_attempts_key_recent_idx
  on public.activation_attempts(key_hash, attempted_at desc);
alter table public.activation_attempts enable row level security;
revoke all on public.activation_attempts from anon, authenticated;

create table if not exists public.license_transfer_audit (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id),
  actor_id uuid not null references public.profiles(id),
  reason text not null check (length(trim(reason)) between 5 and 500),
  transferred_at timestamptz not null default now()
);
create index if not exists license_transfer_audit_license_idx
  on public.license_transfer_audit(license_id, transferred_at desc);
alter table public.license_transfer_audit enable row level security;
revoke all on public.license_transfer_audit from anon, authenticated;

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
      where a.ip_hash = p_ip_hash and a.attempted_at > now() - interval '15 minutes') >= 30 then
    return query select 'rate_limited'::text, null::uuid, null::integer;
    return;
  end if;
  if (select count(*) from public.activation_attempts a
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
      on conflict (license_id, device_hash) do update
        set activated_at = now(), last_seen_at = now(), deactivated_at = null;
  end if;
  update public.activation_attempts set accepted = true where id = v_attempt_id;
  return query select 'active'::text, v_license.id, v_license.activation_epoch;
end $$;
revoke all on function public.claim_hyro_activation(bytea,bytea,bytea)
  from public, anon, authenticated;
grant execute on function public.claim_hyro_activation(bytea,bytea,bytea)
  to service_role;

create or replace function public.admin_transfer_license(
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
revoke all on function public.admin_transfer_license(uuid,text) from public, anon;
grant execute on function public.admin_transfer_license(uuid,text) to authenticated;
