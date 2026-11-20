-- ---------------------------------------------------------------------------
-- Correo de confirmación de compra al cliente (Ley de Protección al Consumidor de El Salvador, art. 21-B b:
-- confirmar la orden a más tardar el día siguiente, con el desglose y el total).
--   purchases.receipt_sent_at  el correo sale una sola vez por compra (como notified_at para el aviso de venta)
-- ---------------------------------------------------------------------------
alter table public.purchases add column if not exists receipt_sent_at timestamptz;
