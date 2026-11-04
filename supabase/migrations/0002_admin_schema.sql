-- Esquema del panel administrativo (Fase 1): roles, comisiones, cortes 50/50 y auditoría.
-- Ejecutar en Supabase (SQL Editor) sobre el proyecto "hyro-enterprise", después de 0001.

-- ---------------------------------------------------------------------------
-- admins
-- ---------------------------------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Semilla: la cuenta del usuario que pidió el panel.
insert into public.admin_users (user_id) values ('f1b1b4e2-be8d-40c3-ab76-c5ba6f286007');

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- comisiones por pasarela (editable; lo aplicado a cada venta se congela en purchases)
-- ---------------------------------------------------------------------------
create table public.gateway_fees (
  platform text primary key,
  fee_percent numeric(5, 2) not null,
  updated_at timestamptz not null default now()
);

insert into public.gateway_fees (platform, fee_percent) values ('wompi', 3.50);

-- ---------------------------------------------------------------------------
-- cortes (reparto 50/50 entre los dos socios)
-- ---------------------------------------------------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  gross_amount numeric(10, 2) not null default 0,
  fees_amount numeric(10, 2) not null default 0,
  net_amount numeric(10, 2) not null default 0,
  partner_a_share numeric(10, 2) not null default 0,
  partner_b_share numeric(10, 2) not null default 0,
  partner_a_confirmed boolean not null default false,
  partner_b_confirmed boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  completed_by uuid references auth.users (id),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- compras: plataforma, comisión congelada y a qué corte pertenecen
-- ---------------------------------------------------------------------------
alter table public.purchases
  add column platform text not null default 'wompi' check (platform in ('wompi', 'paypal')),
  add column fee_percent numeric(5, 2),
  add column fee_amount numeric(10, 2),
  add column net_amount numeric(10, 2),
  add column paid_at timestamptz,
  add column settlement_id uuid references public.settlements (id);

create index purchases_settlement_id_idx on public.purchases (settlement_id);
create index purchases_paid_at_idx on public.purchases (paid_at);

-- ---------------------------------------------------------------------------
-- realizar un corte: calcula el periodo, inserta el settlement y marca las
-- compras incluidas en una sola operación (una venta nunca queda en dos cortes).
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_settlement(
  p_period_start date,
  p_period_end date,
  p_partner_a_confirmed boolean,
  p_partner_b_confirmed boolean
)
returns public.settlements
language plpgsql
as $$
declare
  v_gross numeric(10, 2);
  v_fees numeric(10, 2);
  v_net numeric(10, 2);
  v_share_a numeric(10, 2);
  v_share_b numeric(10, 2);
  v_settlement public.settlements;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede realizar un corte';
  end if;

  select coalesce(sum(amount), 0), coalesce(sum(fee_amount), 0), coalesce(sum(net_amount), 0)
    into v_gross, v_fees, v_net
    from public.purchases
    where status = 'paid'
      and settlement_id is null
      and paid_at::date between p_period_start and p_period_end;

  v_share_a := round(v_net / 2, 2);
  v_share_b := v_net - v_share_a;

  insert into public.settlements (
    period_start, period_end, status, gross_amount, fees_amount, net_amount,
    partner_a_share, partner_b_share, partner_a_confirmed, partner_b_confirmed,
    created_by, completed_by, completed_at
  ) values (
    p_period_start, p_period_end,
    case when p_partner_a_confirmed and p_partner_b_confirmed then 'completed' else 'pending' end,
    v_gross, v_fees, v_net, v_share_a, v_share_b, p_partner_a_confirmed, p_partner_b_confirmed,
    auth.uid(),
    case when p_partner_a_confirmed and p_partner_b_confirmed then auth.uid() else null end,
    case when p_partner_a_confirmed and p_partner_b_confirmed then now() else null end
  ) returning * into v_settlement;

  update public.purchases
    set settlement_id = v_settlement.id
    where status = 'paid'
      and settlement_id is null
      and paid_at::date between p_period_start and p_period_end;

  return v_settlement;
end;
$$;

-- ---------------------------------------------------------------------------
-- historial de precios de planes
-- ---------------------------------------------------------------------------
create table public.plan_price_history (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans (id),
  old_price numeric(10, 2) not null,
  new_price numeric(10, 2) not null,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- registro de actividad administrativa
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users (id),
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.admin_users enable row level security;
alter table public.gateway_fees enable row level security;
alter table public.settlements enable row level security;
alter table public.plan_price_history enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "un admin ve su propia fila de admin_users" on public.admin_users
  for select using (auth.uid() = user_id);

create policy "admins leen comisiones" on public.gateway_fees for select using (public.is_admin());
create policy "admins editan comisiones" on public.gateway_fees for update using (public.is_admin()) with check (public.is_admin());

create policy "admins leen cortes" on public.settlements for select using (public.is_admin());

create policy "admins leen historial de precios" on public.plan_price_history for select using (public.is_admin());
create policy "admins insertan historial de precios" on public.plan_price_history for insert with check (public.is_admin());

create policy "admins leen el registro de actividad" on public.admin_audit_log for select using (public.is_admin());
create policy "admins insertan en el registro de actividad" on public.admin_audit_log for insert with check (public.is_admin());

-- Los admins también necesitan ver/editar todo lo de los clientes (no solo lo suyo).
create policy "admins ven todas las compras" on public.purchases for select using (public.is_admin());
create policy "admins actualizan compras" on public.purchases for update using (public.is_admin()) with check (public.is_admin());
create policy "admins ven todas las licencias" on public.licenses for select using (public.is_admin());
create policy "admins ven todas las reseñas" on public.reviews for select using (public.is_admin());
create policy "admins editan planes" on public.plans for update using (public.is_admin()) with check (public.is_admin());
create policy "admins editan productos" on public.products for update using (public.is_admin()) with check (public.is_admin());
create policy "admins leen todos los perfiles" on public.profiles for select using (public.is_admin());
