# Hyro

Landing de HYRO VISUALS: Astro + Tailwind CSS, GSAP (ScrollTrigger y SplitText) y Lenis. Incluye hero y sección de compra.

## Desarrollo

```sh
npm install
npm run dev
```

## Cuentas HYRO

La página `/cuenta/` usa Supabase Auth del proyecto `hyro-company` para registro por correo, inicio y cierre de sesión. Al registrarse, la base crea automáticamente el perfil del usuario. La compra y la biblioteca de licencias todavía no están conectadas.

1. Copia `.env.example` a `.env` y completa `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY` con los valores de `hyro-company`. La clave publicable puede usarse en el navegador; nunca pongas una clave secreta o `service_role` en variables `PUBLIC_`.
2. En [Auth → URL Configuration](https://supabase.com/dashboard/project/vvotpvgnzktrxsquztpq/auth/url-configuration), añade `http://localhost:4321/cuenta/` a las URL de retorno para las pruebas. Usa `http://localhost:4321` al abrir la landing.
3. Cuando publiques la landing, configura su URL real como **Site URL**, añade `https://TU-DOMINIO/cuenta/` a las URL de retorno y define las dos variables públicas también en el servicio de despliegue.

El correo de confirmación depende de Supabase Auth. Para un lanzamiento público, configura un proveedor SMTP propio y prueba registro, confirmación y acceso con una cuenta real.

## Administración

La ruta `/admin/` muestra clientes, sus compras con estado `paid` y permite cambiar entre los roles `customer` y `admin`. Solo un administrador puede leer esta información o cambiar roles; los permisos se comprueban en Supabase, no solo en la página. Los usuarios normales no pueden editar directamente el campo `role`. La cuenta existente de Erick Caceres quedó como administrador inicial en `hyro-company`.

Las migraciones de esta función están en `supabase/migrations/`. Cuando haya más clientes, sus productos comprados aparecerán en el panel después de registrar órdenes pagadas en `orders` y `order_items`.

## Comprobaciones

```sh
npm run check
npm run build
npm run preview -- --port 4323
```

Con la vista previa abierta, en otra terminal:

```sh
npm run verify:header
```

La comprobación usa Microsoft Edge instalado, recorre 360/768/1440px y verifica el crossfade, idiomas, tema y movimiento reducido. Capturas en `artifacts/` (ignorado por Git).

## Editar

- `src/styles/global.css`: tokens de temas, tipografías, tamaños y estilos.
- `src/components/`: piezas reutilizables.
- `src/i18n/`: textos ES/EN.
- `src/scripts/`: preferencias, carrusel, animaciones e inicialización.
- `public/media/`: cuatro clips MP4 optimizados de tres segundos y poster.
- `DESIGN_RULES.md`: criterios que deben seguir las siguientes secciones.

Los MOV originales en `src/videos/` se conservan. La página sirve las versiones MP4 de `public/media/`. Los enlaces a secciones futuras quedan preparados. El botón del hero lleva a `#compra` con desplazamiento suave. El botón «Comprar ahora» está deshabilitado hasta integrar el pago.

`npm run format` aplica el formato de Astro al código.
