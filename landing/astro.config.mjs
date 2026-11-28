// @ts-check
import { defineConfig } from 'astro/config';

// Landing estática: HTML/CSS casi sin JS. Cuando lleguen login y dashboard se agrega el adaptador de Cloudflare
// y esas páginas se sirven en el servidor (prerender = false); la landing seguirá siendo estática.
export default defineConfig({
  site: 'https://byhyro.com',
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: { prefixDefaultLocale: false },
  },
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
