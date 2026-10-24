-- TEST PROJECT ONLY: schema snapshot for isolated Wompi validation; contains no production customer data.
set search_path=public;
create table public.license_activations (
  id uuid default gen_random_uuid() not null,
  license_id uuid not null,
  device_hash bytea not null,
  activated_at timestamp with time zone default now() not null,
  last_seen_at timestamp with time zone default now() not null,
  deactivated_at timestamp with time zone
);
create table public.licenses (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  product_id uuid not null,
  order_id uuid not null,
  order_item_id uuid not null,
  key_hash bytea not null,
  status text default 'active'::text not null,
  max_activations integer default 1 not null,
  issued_at timestamp with time zone default now() not null,
  revoked_at timestamp with time zone,
  key_ciphertext bytea,
  key_nonce bytea,
  key_version smallint,
  activation_epoch integer default 0 not null
);
create table public.order_items (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  product_id uuid not null,
  unit_price_cents integer not null,
  currency text not null,
  quantity integer default 1 not null,
  created_at timestamp with time zone default now() not null
);
create table public.orders (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  status text default 'pending'::text not null,
  total_cents integer not null,
  currency text default 'USD'::text not null,
  paypal_order_id text,
  paypal_capture_id text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  payhip_transaction_id text,
  buyer_email text
);
create table public.product_builds (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null,
  platform text not null,
  version text not null,
  object_key text not null,
  file_name text not null,
  size_bytes bigint not null,
  sha256 text not null,
  is_active boolean default false not null,
  created_at timestamp with time zone default now() not null
);
create table public.products (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  name text not null,
  description text,
  price_cents integer not null,
  currency text default 'USD'::text not null,
  installer_path text,
  is_active boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table public.profiles (
  id uuid not null,
  display_name text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  role text default 'customer'::text not null
);
alter table public.licenses add constraint licenses_pkey PRIMARY KEY (id);
alter table public.order_items add constraint order_items_pkey PRIMARY KEY (id);
alter table public.product_builds add constraint product_builds_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.license_activations add constraint license_activations_pkey PRIMARY KEY (id);
alter table public.orders add constraint orders_pkey PRIMARY KEY (id);
alter table public.products add constraint products_pkey PRIMARY KEY (id);
alter table public.products add constraint products_slug_key UNIQUE (slug);
alter table public.order_items add constraint order_items_id_order_id_product_id_key UNIQUE (id, order_id, product_id);
alter table public.licenses add constraint licenses_user_id_product_id_key UNIQUE (user_id, product_id);
alter table public.product_builds add constraint product_builds_product_id_platform_version_key UNIQUE (product_id, platform, version);
alter table public.license_activations add constraint license_activations_license_id_device_hash_key UNIQUE (license_id, device_hash);
alter table public.order_items add constraint order_items_order_id_product_id_key UNIQUE (order_id, product_id);
alter table public.products add constraint products_installer_path_key UNIQUE (installer_path);
alter table public.licenses add constraint licenses_order_item_id_key UNIQUE (order_item_id);
alter table public.licenses add constraint licenses_key_hash_key UNIQUE (key_hash);
alter table public.product_builds add constraint product_builds_object_key_key UNIQUE (object_key);
alter table public.orders add constraint orders_paypal_order_id_key UNIQUE (paypal_order_id);
alter table public.orders add constraint orders_paypal_capture_id_key UNIQUE (paypal_capture_id);
alter table public.orders add constraint orders_buyer_email_check CHECK (((buyer_email IS NULL) OR (((length(buyer_email) >= 3) AND (length(buyer_email) <= 320)) AND (buyer_email = lower(TRIM(BOTH FROM buyer_email))))));
alter table public.orders add constraint orders_total_cents_check CHECK ((total_cents >= 0));
alter table public.license_activations add constraint license_activations_device_hash_check CHECK ((octet_length(device_hash) = 32));
alter table public.profiles add constraint profiles_display_name_check CHECK (((display_name IS NULL) OR ((length(display_name) >= 1) AND (length(display_name) <= 120))));
alter table public.products add constraint products_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text));
alter table public.products add constraint products_name_check CHECK (((length(name) >= 1) AND (length(name) <= 160)));
alter table public.products add constraint products_price_cents_check CHECK ((price_cents >= 0));
alter table public.products add constraint products_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text));
alter table public.products add constraint products_installer_path_check CHECK (((installer_path IS NULL) OR (installer_path ~ '^[a-z0-9]+(-[a-z0-9]+)*/[a-zA-Z0-9._/-]+$'::text)));
alter table public.orders add constraint orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'refunded'::text])));
alter table public.orders add constraint orders_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text));
alter table public.order_items add constraint order_items_unit_price_cents_check CHECK ((unit_price_cents >= 0));
alter table public.order_items add constraint order_items_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text));
alter table public.order_items add constraint order_items_quantity_check CHECK ((quantity = 1));
alter table public.licenses add constraint key_recovery_fields_together CHECK ((((key_ciphertext IS NULL) AND (key_nonce IS NULL) AND (key_version IS NULL)) OR ((key_ciphertext IS NOT NULL) AND (key_nonce IS NOT NULL) AND (key_version IS NOT NULL))));
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'admin'::text])));
alter table public.licenses add constraint licenses_activation_epoch_check CHECK ((activation_epoch >= 0));
alter table public.orders add constraint paid_has_gateway_transaction CHECK (((status <> 'paid'::text) OR ((paid_at IS NOT NULL) AND (((paypal_capture_id IS NOT NULL) AND (payhip_transaction_id IS NULL)) OR ((paypal_capture_id IS NULL) AND (payhip_transaction_id IS NOT NULL))))));
alter table public.product_builds add constraint product_builds_platform_check CHECK ((platform = ANY (ARRAY['windows'::text, 'macos'::text])));
alter table public.product_builds add constraint product_builds_version_check CHECK (((length(version) >= 1) AND (length(version) <= 50)));
alter table public.product_builds add constraint product_builds_object_key_check CHECK (((length(object_key) >= 1) AND (length(object_key) <= 512)));
alter table public.product_builds add constraint product_builds_file_name_check CHECK ((file_name ~ '^[A-Za-z0-9._-]+$'::text));
alter table public.product_builds add constraint product_builds_size_bytes_check CHECK ((size_bytes > 0));
alter table public.product_builds add constraint product_builds_sha256_check CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text));
alter table public.licenses add constraint licenses_key_hash_check CHECK ((octet_length(key_hash) = 32));
alter table public.licenses add constraint licenses_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text])));
alter table public.licenses add constraint licenses_max_activations_check CHECK (((max_activations >= 1) AND (max_activations <= 100)));
alter table public.licenses add constraint licenses_key_ciphertext_check CHECK (((key_ciphertext IS NULL) OR (octet_length(key_ciphertext) > 32)));
alter table public.licenses add constraint licenses_key_nonce_check CHECK (((key_nonce IS NULL) OR (octet_length(key_nonce) = 12)));
alter table public.licenses add constraint licenses_key_version_check CHECK (((key_version IS NULL) OR (key_version > 0)));
alter table public.orders add constraint orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
alter table public.order_items add constraint order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
alter table public.licenses add constraint licenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public.licenses add constraint licenses_order_item_id_order_id_product_id_fkey FOREIGN KEY (order_item_id, order_id, product_id) REFERENCES order_items(id, order_id, product_id);
alter table public.licenses add constraint licenses_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id);
alter table public.license_activations add constraint license_activations_license_id_fkey FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE;
alter table public.licenses add constraint licenses_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
alter table public.product_builds add constraint product_builds_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
alter table public.license_activations enable row level security;
revoke all on public.license_activations from public,anon,authenticated;
grant all on public.license_activations to service_role;
alter table public.licenses enable row level security;
revoke all on public.licenses from public,anon,authenticated;
grant all on public.licenses to service_role;
alter table public.order_items enable row level security;
revoke all on public.order_items from public,anon,authenticated;
grant all on public.order_items to service_role;
alter table public.orders enable row level security;
revoke all on public.orders from public,anon,authenticated;
grant all on public.orders to service_role;
alter table public.product_builds enable row level security;
revoke all on public.product_builds from public,anon,authenticated;
grant all on public.product_builds to service_role;
alter table public.products enable row level security;
revoke all on public.products from public,anon,authenticated;
grant all on public.products to service_role;
alter table public.profiles enable row level security;
revoke all on public.profiles from public,anon,authenticated;
grant all on public.profiles to service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select on public.products to anon, authenticated;
create policy products_read on public.products for select to anon, authenticated using(is_active);
grant select on public.profiles to authenticated;
create policy profiles_self_read on public.profiles for select to authenticated using(id=(select auth.uid()));
grant select(id,product_id,status,user_id) on public.licenses to authenticated;
create policy licenses_self_read on public.licenses for select to authenticated using(user_id=(select auth.uid()));
grant select(id,product_id,platform,file_name,is_active) on public.product_builds to authenticated;
create policy builds_licensed_read on public.product_builds for select to authenticated using(is_active and exists(select 1 from public.licenses l where l.product_id=product_builds.product_id and l.user_id=(select auth.uid()) and l.status='active'));
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
insert into public.profiles(id,display_name) values(new.id,nullif(left(trim(new.raw_user_meta_data->>'full_name'),120),''));
return new;
end;$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.products(slug,name,price_cents,currency,is_active) values('hyro-visuals','HYRO Visuals',2000,'USD',true);
