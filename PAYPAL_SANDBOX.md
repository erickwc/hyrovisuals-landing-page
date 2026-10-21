# HYRO-Checkout · Sandbox

Rama: `codex/paypal-sandbox-checkout`, creada desde `main` (`1ca9864`). Payhip y su entrega siguen en `main`; esta rama no modifica sus scripts, webhooks ni tablas.

En esta rama el botón de compra lleva a `/compra/sandbox/`. Requiere una sesión HYRO, crea una orden PayPal de $20 USD y redirige al comprador al sitio Sandbox. Al volver, el servidor comprueba la cuenta propietaria, moneda, importes y destinatarios, captura la orden y confirma ambos pagos. Una recarga consulta la misma orden y no vuelve a cobrar una orden completada. Los errores o capturas parciales no generan confirmación de éxito.

| Vendedor Sandbox | Merchant ID | Importe bruto |
| --- | --- | --- |
| sb-43s564753470315@business.example.com | 8CFHEVR7JKBYN | $10 USD |
| sb-t25lh53470319@business.example.com | JB93BNVTVJBTG | $10 USD |

Son importes brutos. PayPal descuenta su comisión; en la prueba anterior cada cuenta recibió $9.01 netos. No se cobra comisión adicional de plataforma.

## Desarrollo local

1. `.env` necesita las variables públicas Supabase y `PUBLIC_PAYPAL_SANDBOX_ENABLED=true`. `.env.production` ya activa la interfaz Sandbox para los builds de esta rama.
2. Copiar `.dev.vars.example` a `.dev.vars` y completar las credenciales de **HYRO-Checkout Sandbox**. No usar secretos en variables `PUBLIC_`, commits ni código del navegador. `.dev.vars` está ignorado por Git.
3. `npm run build`.
4. `npx wrangler pages dev dist --port 8788`.
5. Abrir `http://localhost:8788`, iniciar sesión en HYRO y pulsar Comprar. `astro dev` por sí solo no ejecuta las funciones `/api/` de Cloudflare.
6. En PayPal usar un comprador Sandbox distinto de los vendedores, por ejemplo `sb-5bnv653381053@personal.example.com`. Consultar su contraseña en PayPal Developer → Sandbox Accounts, sin cambiarla.
7. Completar el pago, comprobar dos capturas `COMPLETED` de $10 en la página de retorno y en la actividad de ambos vendedores. Recargar y verificar que se muestran los mismos identificadores.

`npm run verify:paypal` comprueba la lógica del servidor con respuestas simuladas: sesión, pertenencia, importes y destinatarios, captura, idempotencia, pago parcial y rechazos. No sustituye una prueba real de retorno desde PayPal en el servidor local.

### Prueba integrada completada · 21 de octubre de 2026

Se inició sesión en HYRO en `localhost:8788`, se creó la orden desde el botón de la página y se aprobó con el comprador Sandbox. La página de retorno verificó ambos pagos como `COMPLETED`:

- Orden: `39Y34524KY3960236`.
- Vendedor 1: captura `7HN41519CA055632X`, $10.00 brutos, $0.99 de comisión, $9.01 netos.
- Vendedor 2: captura `54A103886X5533306`, $10.00 brutos, $0.99 de comisión, $9.01 netos.

Se recargó la página de retorno y se recuperaron los mismos dos identificadores de captura, sin otro cobro. La prueba usa dinero simulado y no generó licencias reales.

## Preview en Cloudflare

Configurar los secretos `PAYPAL_SANDBOX_CLIENT_ID` y `PAYPAL_SANDBOX_CLIENT_SECRET` únicamente en el entorno **Preview** de Pages. La función usa siempre `api-m.sandbox.paypal.com`; no tiene modo Live. La bandera del servidor `PAYPAL_SANDBOX_ENABLED=true` habilita la API, y `PUBLIC_PAYPAL_SANDBOX_ENABLED=true` selecciona el botón al compilar. No se publica automáticamente al crear esta rama.

## Alcance y regreso a Payhip

El resultado Sandbox no crea pedidos pagados, licencias ni descargas en la base real de HYRO. La entrega actual de Payhip conserva su comportamiento. Conectar una futura compra PayPal real a licencias requiere un flujo de persistencia, webhooks y reembolsos independiente antes de habilitar Live.

Para seguir trabajando con Payhip, guardar los cambios de esta rama y ejecutar `git switch main`. Para seleccionar Payhip dentro de esta rama, compilar con `PUBLIC_PAYPAL_SANDBOX_ENABLED=false` y deshabilitar la API con `PAYPAL_SANDBOX_ENABLED=false`. Las variables `.env` y `.dev.vars` son locales y no cambian al cambiar de rama; quitar la bandera local si se regresa a `main`.

Documentación: [pagos a varios vendedores](https://developer.paypal.com/platforms/checkout/standard/customize/multiseller-payments), [variables y secretos de Pages Functions](https://developers.cloudflare.com/pages/functions/bindings/).
