# Hyro Visuals — web (Astro)

Reescritura ligera de byhyro.com. Stack: Astro · Supabase · Resend · Cloudflare · PayPal.

## Fase 1: landing (lista)

- `/` español, `/en/` inglés. Textos en `src/i18n/es.ts` y `src/i18n/en.ts`.
- Secciones en `src/components/landing/`. Estilos en `src/styles/global.css`.
- Único JS del cliente: `src/scripts/landing.ts` (~10 KB): menú, tema, idioma, modos del inicio, recorrido,
  galería, ticket de compra, reseñas, newsletter y búsqueda.
- `public/boot.js`: tema, idioma y «Mi cuenta» antes de pintar (archivo aparte por la CSP de `public/_headers`).
- Precios y reseñas reales de Supabase se leen **en el build** (`src/lib/supabase-rest.ts`) y el navegador
  los refresca. Si Supabase no responde, quedan los planes de respaldo (`FALLBACK_PLANS`).
- Fotos de las gráficas en `public/gallery/`, capturas del programa en `public/shots/`.
- Sin animaciones todavía (intro, visuales en vivo, cintas, mascota): se agregan después.

## Desarrollo

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # sale en dist/
```

Variables en `.env` (ver `.env.example`): `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` (públicas por diseño).

Astro 6 (Astro 7 pide Node ≥ 22.23.4).

## Siguiente fase

Login, registro, recuperar contraseña, checkout (PayPal) y dashboard del cliente: se agrega el adaptador de
Cloudflare y esas páginas se sirven en el servidor; la landing sigue siendo estática.
