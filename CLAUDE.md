# Hyro Visuals — landing

Vite + React 18 + TypeScript. Textos en `src/data/content.ts` (ES/EN), tema e idioma en `src/lib/prefs.tsx`.

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

## Publicar en byhyro.com/web3

Se compila con `npm run build:web3` y el resultado se copia a `public/web3/` del repo principal.
Detalles de fuentes, rutas y despliegue: ver el historial de commits de `byhyro/web3`.
