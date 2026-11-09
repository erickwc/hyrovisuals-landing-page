# Hyro Visuals — web (byhyro.com)

Dos páginas que Vite compila juntas:

- **Landing** (`/`): `index.html`, HTML/CSS/JS sin React. Estilos, scripts, imágenes y fuentes en `public/landing/`
  (textos ES en el HTML, EN en `public/landing/js/i18n.js`; enlaces a login, registro y checkout en el `CONFIG` de
  `public/landing/js/app.js`). Lo único que compila Vite ahí es `src/landing/main.ts`: `session.ts` (con sesión
  iniciada cambia «Iniciar sesión / Crear cuenta» por «Mi cuenta») y `data.ts` (precios de la tabla `plans`, reseñas
  de `public_reviews` y newsletter en `newsletter_subscribers`, por fetch a la API REST), que le pasa los datos a
  app.js por `window.HyroLanding`. Los precios de respaldo de `PLANS` en app.js deben coincidir con Supabase.
  app.js arranca cada sección con `safe()` y el `<head>` quita la intro si la web no carga: un error en un navegador
  (p. ej. Safari de iPhone) no puede dejar la intro trabada. La landing anterior en React está en la rama `landing-anterior`.
- **App** (login, registro, recuperar contraseña, checkout, `/cuenta`, `/admin`): `app.html` + React 18 + TypeScript.
  Textos en `src/data/content.ts` (ES/EN), tema e idioma en `src/lib/prefs.tsx` (mismas claves `hyro.theme` y
  `hyro.lang` que la landing).
- **Rutas**: las de la app se reescriben a `app.html` en `public/_redirects` (Cloudflare) y en `APP_ROUTES` de
  `vite.config.ts` (dev y preview). Una ruta nueva en `App.tsx` va en los dos. Ir a `/` desde React recarga la landing.

Las reglas de abajo (iconos y botones) son para la app de React.

## Iconos: una sola librería

**Todos los iconos de la web salen de Animate UI → Hugeicons** (https://animate-ui.com/docs/icons/hugeicons).
Así el trazo, el tamaño y la animación son los mismos en toda la página.

- Los iconos viven en `src/components/animate-ui/icons/hugeicons/<nombre>.tsx` y se usan como componentes:
  `<Search01 size={19} />`. Para animarlos al pasar el cursor, envuelve el botón o enlace:
  `<AnimateIcon animateOnHover asChild><button>…</button></AnimateIcon>`.
- **Antes de dibujar o pegar un SVG, busca el icono en la documentación** y agrégalo con:
  `node scripts/add-icon.mjs <nombre>` (ej. `arrow-right-02`). No instales `@animate-ui/react`: pide React 19;
  el núcleo ya está copiado en `src/components/animate-ui/icons/icon.tsx`.
- Si el icono **no existe en la colección animada** (logos de Apple/Windows, ojo de contraseña…):
  usa el trazado del set gratuito de Hugeicons en `src/components/HugeIcons.tsx` (mismo trazo, `currentColor`).
  Si necesita animación, sigue el patrón de `src/components/animate-ui/icons/translate.tsx`.
- **No usar**: `<svg>` sueltos para iconos, emojis o símbolos como ★ ⌘ ✓ → ▶ en lugar de iconos,
  ni otras librerías (Lucide, Heroicons, Font Awesome…).
- Quedan fuera de esta regla las ilustraciones y visuales de producto (visualizador, cursor de las tarjetas
  de Funciones) y los logos de marca.

## Botones

Usa siempre `src/components/Button.tsx` (variantes `solid` y `ghost`, tamaños `sm`/`md`/`lg`, `arrow`):
el relleno rojo al hacer hover está resuelto ahí. No crear `<a className="btn">` a mano.

## Publicar en byhyro.com

La rama `main` es esta web: Cloudflare Pages (proyecto `byhyro`) la compila con `npm run build` y sirve `dist/`
en byhyro.com. Las variables públicas del build están en `.env.production`; `public/_redirects` manda los enlaces
viejos de `/web3/…` a la raíz. La web anterior (Astro) quedó en la rama `web-anterior`.
Las funciones de Supabase (`supabase/functions`) y las migraciones se publican aparte con el CLI de Supabase.
