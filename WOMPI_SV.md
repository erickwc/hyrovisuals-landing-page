# Checkout personalizado Wompi El Salvador

`/checkout/` ahora incluye el formulario de tarjeta dentro de HYRO: número, vencimiento, CVV, datos de contacto y dirección de facturación. Conserva tema claro/oscuro, ES/EN y el estilo del sitio. Después de enviarlo, Wompi proporciona una URL para completar 3DS; ese paso puede abrir una pantalla de Wompi o del banco. No se implementa un cobro alternativo sin 3DS.

## Ver el diseño sin credenciales

En la rama `feat/wompi-sv-hosted-checkout`, ejecutar `npm install` y `npm run dev`, y abrir `/checkout/` en la URL local que indique Astro. Sin `PUBLIC_WOMPI_CHECKOUT_ENABLED=true`, se muestra una vista previa con el ingreso y envío de pagos desactivados. No introducir tarjetas reales en vistas previas o pruebas.

Payhip sigue siendo la compra principal. `PUBLIC_WOMPI_CHECKOUT_ENABLED=true` añade un enlace secundario y activa la conexión del formulario; no reemplaza Payhip. El usuario debe iniciar sesión con una cuenta HYRO verificada antes de que se habiliten los campos. No se ha realizado merge ni despliegue a producción.

## Estado del entorno de prueba (23 de octubre de 2026)

Se creó el proyecto aislado de Supabase **hyro-wompi-test** (`qykcpdvmyejtnekmvzld`). Se aplicó el esquema de arranque exclusivo de pruebas [`supabase/testing/wompi-test-bootstrap.sql`](supabase/testing/wompi-test-bootstrap.sql) y las dos migraciones Wompi. Se desplegó `wompi-card` solo en ese proyecto y se configuraron allí las credenciales de desarrollo, la clave de licencias, el origen HTTPS de prueba y los destinos de regreso de Auth. Los secretos no están en Git. La función confirmó modo `test` y obtuvo las regiones de Wompi usando una sesión real del proyecto de pruebas. El negocio Wompi indicó `estaProductivo: false`.

La página estática de prueba se compiló contra este proyecto con el formulario activado. El recorrido de navegador inició sesión con una cuenta sintética confirmada, llegó a `/checkout/`, habilitó el formulario y mostró **MODO DE PRUEBA · SIN COBRO REAL**. No se observó ninguna solicitud al proyecto de producción. La contraseña de esa cuenta está solo en `.env.wompi-account`, excluido de Git; no la compartas por chat. Puedes abrir la vista temporal en `https://appropriate-seat-bringing-exchanges.trycloudflare.com/checkout/` mientras el túnel siga activo. Es una URL de prueba que puede dejar de funcionar o cambiar; no es un despliegue permanente.

El proyecto de pruebas tiene **Confirm Email desactivado**, igual que el registro actual de HYRO: al crear una cuenta se obtiene una sesión de inmediato, sin correo de verificación ni depender del límite de correo integrado de Supabase. Esto se verificó con una cuenta sintética. La cuenta del sitio de producción no se copia al proyecto de pruebas: cada persona debe registrarse de nuevo en la vista de prueba. El correo personal usado para diagnosticar el problema quedó libre para registrarse desde el formulario. Antes de cualquier despliegue productivo, revisar si se desea mantener esta política de correo sin verificar.

**Falta la única prueba externa del pago completo:** Wompi no publica un número de tarjeta autorizado para probar su flujo 3DS en la documentación consultada. Usa exclusivamente una tarjeta o datos de prueba autorizados por Wompi en el entorno de desarrollo para completar 3DS y comprobar el estado `test_paid`. No introduzcas una tarjeta real hasta verificar con Wompi y el adquirente los requisitos para captura directa. El modo de prueba no emite licencia real. No se ha activado producción ni modificado Payhip.

## Preparar una prueba con Wompi

1. Usar un proyecto de Supabase de prueba con el esquema base de HYRO y las migraciones existentes. Aplicar `20261023231132_wompi_sv_checkout.sql` y después `20261023232142_wompi_card_3ds.sql`. Estas migraciones no se han aplicado a producción.
2. Crear/configurar un negocio Wompi El Salvador en modo **desarrollo** y obtener App ID y API Secret desde su panel. Confirmar con Wompi la habilitación de su API de compra con 3DS y los datos de tarjeta autorizados para pruebas. No enviar credenciales o tarjetas por chat, correo o Git.
3. Desplegar únicamente la función `wompi-card` en el proyecto de prueba con la verificación JWT de plataforma deshabilitada para ese webhook. El handler comprueba JWT contra Supabase Auth para cada solicitud de navegador y HMAC-SHA256 para cada webhook. Ejemplo, tras validar el proyecto de destino: `supabase functions deploy wompi-card --project-ref TEST_PROJECT_REF --no-verify-jwt`.
4. Configurar los secretos del ejemplo `supabase/functions/wompi-card/.env.example`: `WOMPI_CARD_ENABLED=true`, `WOMPI_MODE=test`, `WOMPI_CARD_LIVE_ENABLED=false`, App ID, API Secret, origen HTTPS del sitio de prueba y clave de cifrado de licencias AES-GCM (32 bytes en base64). Supabase suministra URL, service role y anon key en el runtime; opcionalmente usar `HYRO_SUPABASE_PUBLISHABLE_KEY` para una clave pública diferente. Ningún secreto va en variables `PUBLIC_`.
5. Construir el sitio de prueba con `PUBLIC_WOMPI_CHECKOUT_ENABLED=true`, `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY` del proyecto de prueba. Confirmar las cabeceras de `public/_headers` en el alojamiento: no caché, no referrer y no incrustación del checkout. La función exige el origen HTTPS configurado.
6. Completar una transacción de prueba con 3DS. El servidor consulta `/Aplicativo` antes de crear la transacción y exige que el modo de Wompi coincida con `WOMPI_MODE`. Un negocio productivo en un entorno configurado como prueba bloquea la solicitud antes de enviar la tarjeta al endpoint de compra.
7. Al regresar, HYRO debe mostrar **Pago de prueba confirmado**. No se crea una orden pagada ni una licencia real para una transacción simulada. Probar también cancelación, reintentos y fallo de conexión. La documentación oficial aclara que la simulación de denegación con CVV `111` no aplica a 3DS; no usarla como prueba de rechazo 3DS.

## Datos, confirmación e idempotencia

El backend llama al endpoint documentado en el Swagger oficial `POST /TransaccionCompra/3Ds`, con precio calculado por servidor ($20 USD), identificador `idExterno` propio y destinos de retorno/webhook propios. Países y regiones proceden del endpoint oficial `/api/Regiones` y se validan de nuevo en servidor. Nunca se aceptan precios, URLs o metadatos del navegador para configurar el cobro.

PAN y CVV atraviesan el navegador y el backend de HYRO de forma transitoria. El código no los escribe en base de datos, almacenamiento del navegador, logs, URLs ni respuestas. Los campos se vacían tras cada envío y al abandonar la página. Esto no equivale a asegurar que toda la infraestructura esté certificada: antes de recibir tarjetas reales hay que confirmar con Wompi/adquirente los requisitos PCI DSS de captura directa y verificar que el alojamiento, proxies, observabilidad y herramientas de sesión no registren cuerpos de solicitud ni campos de pago. No se usa tokenización ni se guarda una tarjeta para compras futuras.

La tabla `wompi_card_checkouts` guarda únicamente referencias de cuenta/producto, identificador de solicitud/transacción, modo, correo de la cuenta, estado y URL de 3DS. Las tablas tienen RLS y no son legibles o modificables por `anon`/`authenticated`; solo el backend accede a ellas. El navegador recibe únicamente estados y la URL validada de Wompi.

La reserva SQL serializa solicitudes por comprador, admite un solo intento abierto y limita a tres intentos nuevos cada 15 minutos. Repetir el mismo envío, abrir otra pestaña o cambiar el identificador de solicitud no inicia otra transacción mientras exista un intento pendiente. Si la creación tiene un resultado incierto, el intento queda en revisión, sin reintentar el cobro automáticamente. Soporte debe reconciliarlo con Wompi antes de liberar un intento atascado; no borrarlo ni marcarlo rechazado solo por haber pasado tiempo.

El webhook verifica el HMAC `wompi_hash` sobre los bytes originales. Tanto el webhook como la consulta del navegador verifican la transacción mediante `GET /TransaccionCompra/{id}` y comprueban `idExterno`, transacción, importe, aprobación y modo. Los parámetros del retorno no constituyen prueba de pago. Un webhook puede recuperar una transacción cuyo resultado de creación se perdió. La licencia se emite por una rutina SQL atómica únicamente tras una aprobación real confirmada; la unicidad de transacción y los bloqueos impiden duplicar órdenes/licencias. Las claves se cifran como en el flujo existente de HYRO.

Si Wompi devuelve una URL 3DS fuera de un dominio HTTPS `wompi.sv`, el flujo queda bloqueado para revisión. Confirmar el dominio oficial con Wompi antes de ampliar la lista permitida; no añadir un dominio aportado por el comprador.

## Producción y límites pendientes

La activación real requiere autorización de despliegue, habilitación del negocio/3DS y revisión de captura directa con Wompi, además de `WOMPI_MODE=live` y `WOMPI_CARD_LIVE_ENABLED=true` en el servidor. Esa habilitación no se ha realizado. Se validaron las credenciales de desarrollo; faltan el recorrido completo por 3DS con datos de tarjeta autorizados por Wompi y la verificación de configuración de infraestructura antes de producción.

Los cupones existentes siguen en Payhip. Wompi mantiene el precio fijo en servidor; no se añadió un campo de descuentos sin un modelo propio de cupones. El contrato público consultado no define un webhook verificable de reembolsos: deben gestionarse y revocarse mediante soporte antes de habilitar ventas reales. El backend anterior `wompi-checkout` de enlaces alojados se conserva, pero el formulario nuevo usa `wompi-card`.

## Verificaciones locales

La auditoría de dependencias detecta cinco avisos en la cadena de herramientas existente de Astro. Su actualización requiere revisar una migración mayor; queda pendiente antes de aprobar producción. No se aplicó una actualización automática que pudiera afectar Payhip o el resto del sitio.

- `npm run check`: revisión de tipos y Astro.
- `npm run build`: compilación estática.
- `npm run verify:wompi`: pruebas del flujo alojado y del formulario 3DS, con transporte Wompi simulado y migraciones SQL ejecutadas en PGlite. No realizan cargos ni contactan la API de pagos. Incluyen firma, importe/referencia, prueba sin licencia real, duplicados, permisos y creación incierta.

## Contratos oficiales consultados

- [Swagger Wompi El Salvador](https://api.wompi.sv/index.html), esquema `CrearTransaccion3dsDto` y `CrearTransaccion3dsOutputDto`.
- [Compra con 3DS](https://docs.wompi.sv/metodos-api/crear-transaccion-compra-3ds).
- [Datos del negocio y modo](https://docs.wompi.sv/metodos-api/datos-aplicativo).
- [Países y regiones](https://docs.wompi.sv/metodos-api/obtener-regiones).
- [Autenticación OAuth](https://docs.wompi.sv/autenticacion/autenticacion).
- [Validación del webhook](https://docs.wompi.sv/webhook/validar-webhook).
- [Consulta de transacción](https://docs.wompi.sv/metodos-api/obtener-transaccion-compra-por-id).
- [Modo de prueba y límites de simulación 3DS](https://docs.wompi.sv/metodos-api/transaccion_prueba).
