import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/* La landing es Astro (carpeta landing/, se compila aparte y se junta en dist/ al final de `npm run build`).
   La app de React (login, registro, checkout, cuenta y panel admin) vive en app.html y atiende estas rutas.
   En producción las reescribe public/_redirects (Cloudflare Pages); aquí el plugin hace lo mismo en
   `npm run dev` y `npm run preview`. Si se agrega una ruta nueva en App.tsx, va en los dos lugares. */
const APP_ROUTES = ["/login", "/register", "/recuperar-contrasena", "/checkout", "/cuenta", "/admin", "/legal", "/baja"];

const isAppRoute = (path: string) => APP_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));

function appRoutes(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const path = (req.url ?? "/").split(/[?#]/)[0];
    if (req.method === "GET" && isAppRoute(path)) req.url = "/app.html";
    next();
  };
  return {
    name: "hyro-app-routes",
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
}

/* Los encabezados de seguridad de public/_headers (los que pone Cloudflare Pages) también en `npm run preview`,
   para probar la política de seguridad en local con la web compilada. En `npm run dev` no se aplican: Vite
   inyecta scripts propios que esa política bloquearía. */
function securityHeaders(): Plugin {
  const headers: [string, string][] = [];
  let inRoot = false;
  for (const line of readFileSync(resolve(import.meta.dirname, "public/_headers"), "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      inRoot = line.trim() === "/*";
      continue;
    }
    const i = line.indexOf(":");
    if (inRoot && i > 0) headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return {
    name: "hyro-security-headers",
    configurePreviewServer: (server) =>
      void server.middlewares.use((_req, res, next) => {
        for (const [name, value] of headers) res.setHeader(name, value);
        next();
      }),
  };
}

// Se sirve en la raíz de byhyro.com (Cloudflare Pages compila la rama main con `npm run build`).
export default defineConfig({
  plugins: [react(), appRoutes(), securityHeaders()],
  server: { port: 5173 },
  build: {
    rolldownOptions: {
      // la landing (/ y /en/) es Astro, en landing/: scripts/build-landing.mjs la compila y la copia a dist/
      input: { app: resolve(import.meta.dirname, "app.html") },
    },
  },
});
