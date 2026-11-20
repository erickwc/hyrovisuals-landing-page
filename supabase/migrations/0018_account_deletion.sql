-- ---------------------------------------------------------------------------
-- El cliente puede eliminar su cuenta (Decreto 144, derecho de cancelación/supresión) desde «Mi cuenta», con la
-- función delete-account. Se borra todo lo suyo (cuenta, perfil, foto, reseñas, newsletter, sesiones), PERO la
-- prueba de cada compra se conserva 10 años (Ley de Protección al Consumidor, art. 21-B c):
--   - purchases, licenses y paypal_orders ya no se borran en cascada con el usuario: quedan con user_id = null.
--   - purchases guarda una copia del correo y el nombre de quien compró (buyer_email, buyer_name) y la fecha en
--     que se eliminó la cuenta (account_deleted_at). Solo los admins pueden leer estas filas.
-- ---------------------------------------------------------------------------

alter table public.purchases
  add column if not exists buyer_email text,
  add column if not exists buyer_name text,
  add column if not exists account_deleted_at timestamptz;

alter table public.purchases alter column user_id drop not null;
alter table public.purchases drop constraint if exists purchases_user_id_fkey;
alter table public.purchases
  add constraint purchases_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

alter table public.licenses alter column user_id drop not null;
alter table public.licenses drop constraint if exists licenses_user_id_fkey;
alter table public.licenses
  add constraint licenses_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

alter table public.paypal_orders alter column user_id drop not null;
alter table public.paypal_orders drop constraint if exists paypal_orders_user_id_fkey;
alter table public.paypal_orders
  add constraint paypal_orders_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
