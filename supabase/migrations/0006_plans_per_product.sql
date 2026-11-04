-- Prepara el catálogo para más de un producto: cada plan pasa a pertenecer a un producto,
-- en vez de ser una tabla global de ids ("personal"/"equipos") compartida entre todos.

alter table public.plans add column product_id uuid references public.products (id);

update public.plans set product_id = (select id from public.products where slug = 'hyro-visuals');

alter table public.plans alter column product_id set not null;

-- Las llaves que apuntan a la vieja PK de un solo campo (`plans.id`) hay que soltarlas
-- antes de cambiar la PK de plans a (product_id, id).
alter table public.purchases drop constraint purchases_plan_id_fkey;
alter table public.licenses drop constraint licenses_plan_id_fkey;
alter table public.plan_price_history drop constraint plan_price_history_plan_id_fkey;

alter table public.plans drop constraint plans_pkey;
alter table public.plans add primary key (product_id, id);

alter table public.purchases
  add constraint purchases_plan_product_fkey
  foreign key (product_id, plan_id) references public.plans (product_id, id);

alter table public.licenses
  add constraint licenses_plan_product_fkey
  foreign key (product_id, plan_id) references public.plans (product_id, id);

-- plan_price_history también pasa a identificarse por (product_id, plan_id).
alter table public.plan_price_history add column product_id uuid references public.products (id);
update public.plan_price_history set product_id = (select id from public.products where slug = 'hyro-visuals');
alter table public.plan_price_history alter column product_id set not null;
alter table public.plan_price_history
  add constraint plan_price_history_plan_product_fkey
  foreign key (product_id, plan_id) references public.plans (product_id, id);
