# Hyro Visuals — web (byhyro.com)

Dos proyectos que `npm run build` junta en `dist/`:

- **Landing** (`/` español, `/en/` inglés): **Astro**, en la carpeta `landing/` (ver `landing/README.md`).
  `npm run build` compila primero la app con Vite y luego `scripts/build-landing.mjs` compila Astro (con las variables
  `VITE_SUPABASE_*` de `.env.production` pasadas como `PUBLIC_SUPABASE_*`) y copia `landing/dist/` encima de `dist/`.
  Enlaza a la app por rutas normales: `/login`, `/register`, `/checkout?plan=<id>`, `/cuenta/biblioteca`, `/legal/…`.
  Para trabajar en ella: `npm run dev:landing` (http://localhost:4321). `_headers` y `_redirects` salen de `public/`
  de la raíz, no de `landing/public/`.
  La landing anterior (HTML estático: `index.html` + `public/landing/`) ya no se publica; de `public/landing/` solo
  se copian `fonts/` e `img/`, que usa la app.
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
