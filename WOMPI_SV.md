# Wompi El Salvador — rama de prueba

La opción `/checkout/` conserva el estilo, tema claro/oscuro e idiomas ES/EN de HYRO. El pedido se prepara en HYRO; el número de tarjeta y CVV se introducen únicamente en la página alojada por Wompi (`lk.wompi.sv`). El checkout Payhip de `/` sigue siendo la opción principal. Para mostrar el enlace secundario a Wompi se necesita `PUBLIC_WOMPI_CHECKOUT_ENABLED=true` **solo en un entorno de prueba**.

## Preparación en el entorno de prueba

1. Crear un negocio/aplicativo Wompi El Salvador en **modo desarrollo** en el panel de Wompi. Obtener allí App ID y API Secret. No ponerlos en el chat, en Git ni en variables `PUBLIC_`.
2. Aplicar la migración `20261023231132_wompi_sv_checkout.sql` en una base de datos de prueba de Supabase. No aplicarla en producción durante esta fase.
3. Desplegar la función `wompi-checkout` en un proyecto Supabase de prueba con la verificación JWT de plataforma deshabilitada para esta función, porque el webhook de Wompi no lleva JWT. La función valida el JWT del usuario en las acciones de navegador y el HMAC `wompi_hash` del webhook. No desplegarla en producción durante esta fase.
4. Configurar **secretos de servidor** `WOMPI_ENABLED=true`, `WOMPI_MODE=test`, `WOMPI_APP_ID`, `WOMPI_API_SECRET`, `HYRO_SITE_URL` (origen HTTPS del sitio de prueba), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `LICENSE_ENCRYPTION_KEY` (clave AES-GCM de 32 bytes en base64 que ya usa la emisión de licencias). `PUBLIC_WOMPI_CHECKOUT_ENABLED=true` se configura solo en el build del sitio de prueba. Supabase URL y publishable key pueden estar también en sus variables públicas habituales; **service role y secretos de Wompi nunca**.
5. Probar una compra aprobada y una denegada en modo desarrollo. El webhook debe validar firma, enlace, transacción, importe y modo. En desarrollo **no se emiten licencias**: las transacciones simuladas no cobran dinero. Para comprobar emisión de licencias sin dinero, se requiere una base de datos descartable y una prueba controlada de la rutina SQL.

Las pruebas locales de lógica se ejecutan con `npm run verify:wompi`; la compilación y revisión de tipos con `npm run build` y `npm run check`.

El paso a producción requiere habilitar el negocio Wompi, confirmar que sus métodos de pago y 3DS estén autorizados, configurar `WOMPI_MODE=live`, revisar cumplimiento y ejecutar una compra real pequeña de extremo a extremo antes de activar el botón público. El API de tokenización y el de transacción directa/3DS de Wompi requieren que el comercio reciba número de tarjeta y CVV; esta rama **no los llama**. Wompi controla la captura de tarjeta y la autenticación adicional dentro de su página alojada.

## Comportamiento de entrega

- El servidor obtiene un token OAuth de Wompi, crea `/EnlacePago` por $20 USD con un identificador de checkout, importe no editable, límite de un pago exitoso, retorno y webhook. Solo entrega al navegador una URL HTTPS de `lk.wompi.sv`.
- Un webhook se acepta únicamente si pasa HMAC-SHA256 sobre el cuerpo sin modificar. Además, el servidor consulta `/EnlacePago/{id}` y `/TransaccionCompra/{id}` para comprobar negocio, enlace, resultado aprobado, $20 y `esReal=true` antes de invocar una función SQL de entrega atómica.
- La función SQL usa el identificador único de transacción y bloqueos de filas para idempotencia. Solo `service_role` puede llamarla. La licencia se emite únicamente después de pago real confirmado. El correo del pagador se conserva para soporte, pero la licencia pertenece a la cuenta HYRO que inició el checkout.
- El retorno del navegador es informativo. La página consulta el estado de la orden; los parámetros de URL no activan licencias. Si la confirmación tarda, el comprador conserva el comprobante y evita pagar de nuevo.
- Los cupones actuales son una función de Payhip. Esta rama no muestra un campo de cupón Wompi ni acepta descuentos introducidos por el navegador. Para llevar cupones a Wompi hace falta un modelo propio de reglas y validación de precio en servidor.
- La documentación pública de Wompi consultada describe webhooks de pagos exitosos, no un evento de reembolso con contrato verificable. Los reembolsos Wompi requieren una operación de soporte y revocación controlada antes de activar ventas reales.

## Fuentes oficiales consultadas

- [Autenticación OAuth](https://docs.wompi.sv/autenticacion/autenticacion)
- [Crear enlace de pago](https://docs.wompi.sv/metodos-api/enlace-de-pago)
- [Validar webhook](https://docs.wompi.sv/webhook/validar-webhook)
- [Consultar enlace](https://docs.wompi.sv/metodos-api/obtener-enlace-de-pago-por-id)
- [Consultar transacción](https://docs.wompi.sv/metodos-api/obtener-transaccion-compra-por-id)
- [Modo de prueba](https://docs.wompi.sv/metodos-api/transaccion_prueba)
- [Tokenización](https://docs.wompi.sv/metodos-api/tokenizacion)
- [Compra con 3DS](https://docs.wompi.sv/metodos-api/crear-transaccion-compra-3ds)
