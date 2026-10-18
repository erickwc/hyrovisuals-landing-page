# Entrega de HYRO después de Payhip

El checkout sigue alojado en Payhip. Antes de salir de HYRO, la web crea un intento de compra ligado a la sesión del usuario y lo envía como `metadata[hyro_intent]`. La página de retorno solo informa del estado. La licencia se emite exclusivamente cuando `payhip-webhook` recibe el evento `paid`, verifica la firma y registra la transacción mediante una operación atómica en Supabase. Los eventos repetidos usan el mismo identificador de Payhip y no crean otra licencia. Un reembolso completo revoca el acceso.

## Configuración pendiente

1. En secretos de Edge Functions de Supabase, guardar `PAYHIP_API_KEY` y `LICENSE_ENCRYPTION_KEY` (32 bytes aleatorios en Base64). Nunca ponerlos en variables `PUBLIC_` ni en el repositorio.
2. En Payhip > Settings > Developer, establecer `https://vvotpvgnzktrxsquztpq.supabase.co/functions/v1/payhip-webhook` como webhook y activar `paid` y `refunded`.
3. En Payhip > Settings > Advanced Settings > Checkout Settings, añadir una redirección de éxito solo para el producto `X6ucD` a `https://byhyro.com/biblioteca/?compra=procesando`.
4. Desactivar las claves y los archivos entregados por Payhip para ese producto solo después de probar una compra de principio a fin. Si quedan archivos en Payhip, el correo de Payhip puede seguir ofreciendo la descarga aunque exista redirección.
5. Publicar el código de la web después de completar y probar los pasos anteriores.

La descarga mostrada en la biblioteca es una vista previa. El RAR recibido contiene una versión de prueba de Windows y no se publica. Su tamaño supera el límite por archivo del plan gratuito de Supabase Storage; cuando exista un instalador final, usar almacenamiento privado apto para ese tamaño y autorizar cada descarga desde el backend.

## Verificación antes de publicar

- Comprar con una cuenta HYRO iniciada, confirmar que Payhip redirige a `/biblioteca/` y esperar el webhook.
- Verificar que el pedido aparece una sola vez, que la licencia se muestra solo en esa cuenta y que repetir el evento no crea otra.
- Probar una devolución completa y comprobar que la licencia deja de aparecer.
- No usar la clave generada para activar la aplicación de escritorio aún; la validación de claves no forma parte de esta fase.
