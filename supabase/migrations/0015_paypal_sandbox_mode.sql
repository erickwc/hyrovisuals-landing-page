-- Modo de PayPal elegido desde el panel admin: 'live' (cobros reales) o 'sandbox' (pruebas sin dinero real).
-- Cada pedido guarda su modo para cobrarse con las mismas credenciales con que se creó.
alter table public.payment_methods
  add column if not exists mode text not null default 'live' check (mode in ('live', 'sandbox'));

alter table public.paypal_orders
  add column if not exists mode text not null default 'live' check (mode in ('live', 'sandbox'));
