# PayPal Live · reparto y entrega HYRO

Rama: `codex/paypal-sandbox-checkout`. `main` y los scripts/webhooks de Payhip no se modifican. Sandbox sigue funcionando por separado y nunca entrega licencias reales.

## Destinatarios confirmados

| Cuenta | Bruto por compra |
| --- | --- |
| erickcaceres1717@gmail.com | $10 USD |
| gioesbeats@gmail.com | $10 USD |

Total $20 USD. PayPal descuenta sus comisiones de cada parte. Los correos, importes, moneda y referencias se fijan en el servidor; el navegador no puede reemplazarlos.

## Recorrido de compra

1. El comprador inicia sesión en HYRO. Si ya tiene licencia activa, vuelve a su biblioteca sin pagar otra vez.
2. El servidor guarda un checkout asociado a esa cuenta y crea una orden Live con dos unidades de $10 y desembolso instantáneo.
3. PayPal pide la aprobación del comprador. Al volver a `/compra/paypal/`, el servidor verifica la orden, ambos destinatarios y ambos cobros.
4. Solo con las dos capturas `COMPLETED`, una transacción registra el pedido, los dos identificadores de cobro y una licencia cifrada compatible con `license-key`/`license-server`.
5. HYRO redirige a `/biblioteca/?compra=confirmada`. La biblioteca existente muestra la clave y los instaladores publicados. Cada descarga conserva la validación de sesión y compra de `/api/download`.

La notificación firmada `CHECKOUT.ORDER.APPROVED` también captura y entrega si el comprador cierra el navegador. Las notificaciones repetidas y las recargas reutilizan la orden y la licencia, sin reemplazar una clave activa. Si la base falla después del cobro, la entrega queda pendiente y el reintento verifica los cobros existentes; no inicia otra compra. Las capturas parciales no conceden acceso ni se recapturan automáticamente.

Un reembolso total de cualquiera de las dos capturas o una reversión confirmada revoca la licencia ligada a ese pedido. Un reembolso parcial conserva el acceso. Las notificaciones de compras antiguas no restauran un checkout reembolsado.

## Estado al 21 de octubre de 2026

- La migración `20261021190157_paypal_live_delivery.sql` está aplicada en `hyro-company`. La función `paypal-checkout` versión 1 está desplegada con autenticación propia y responde `503 live_not_configured` mientras Live permanece desactivado. No se han realizado cobros reales.
- App **Hyro-Checkout** encontrada en PayPal Live, asociada al correo de Erick. El usuario confirmó la habilitación Multiparty de ambas cuentas. La ausencia de la sección Multiparty/BN Code en la vista consultada no constituye evidencia de falta de aprobación.
- El webhook Live `0TC71232YL5766314` ya apunta a la función, con aprobación, captura completada, reembolso y reversión. El Client ID y el secreto Live autorizados por el usuario están guardados únicamente en los secretos cifrados de Supabase. También están guardados el ID del webhook y `HYRO_SITE_URL=https://byhyro.com`. `LICENSE_ENCRYPTION_KEY` existente se conserva.
- Antes de aplicar la migración se ejecutó con comprobaciones de compra, idempotencia y reembolso dentro de una transacción revertida. El resultado fue `test_rolled_back = true`: la prueba no dejó pedidos ni licencias ficticios.
- Pruebas locales con PostgreSQL en memoria (PGlite), cifrado real y transporte PayPal simulado. Incluyen entrega por webhook con navegador cerrado, aislamiento de usuario y bloqueo de firmas falsas.
- Se consultó el catálogo real: únicamente está activo Windows `0.2.4` (`hyro-visuals-0.2.4-win-x64.exe`). El instalador Mac debe subirse y registrarse en `product_builds` antes de ofrecerlo.

## Activación pendiente

1. Obtener el **BN Code Live** de la app plataforma. El usuario indicó que lo enviará. PayPal exige esa cabecera en pagos Multiparty; no sirve el BN de Sandbox. Validar el consentimiento de los vendedores con esa app al comprobar el flujo. [Cabeceras de plataforma](https://developer.paypal.com/api/rest/requests/).
2. Guardar `PAYPAL_LIVE_BN_CODE`, activar `PAYPAL_LIVE_ENABLED=true` y crear una orden Live sin aprobarla para comprobar que PayPal acepta exactamente los dos destinatarios. La función ya está desplegada con verificación JWT de pasarela desactivada **solo para ella**: compradores se autentican contra Supabase y notificaciones con firma PayPal.
3. Compilar el frontend con `PUBLIC_PAYPAL_LIVE_ENABLED=true` y publicar la rama al entorno acordado. La interfaz Live tiene prioridad sobre la bandera Sandbox, pero no activa el backend por sí sola.
4. Completar una compra real autorizada y confirmar dos cobros de $10, una licencia, clave visible y descarga del instalador desde la cuenta compradora. Comprobar recuperación y reembolso con PayPal Live antes del lanzamiento público.

La activación y la compra real siguen pendientes del BN Code y de la validación Live. La rama de Git no aísla automáticamente una base de datos o despliegue compartido.

## Verificación local

```sh
npm run verify:paypal
npm run verify:delivery
npm run check
npm run build
```

`scripts/paypal-delivery-rollback-check.sql` es una comprobación opcional para ejecutar **solo dentro de BEGIN/migración/ROLLBACK**, nunca como compra real ni con COMMIT. Los identificadores de esa prueba son ficticios.

Para volver a Payhip en esta rama, desactivar ambas banderas públicas y recompilar. `git switch main` conserva la implementación anterior; no se publicó ni fusionó esta rama.
