import { resolve } from "node:path";
import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/* La landing es index.html: HTML estático con sus estilos y scripts en public/landing/.
   La app de React (login, registro, checkout, cuenta y panel admin) vive en app.html y atiende estas rutas.
   En producción las reescribe public/_redirects (Cloudflare Pages); aquí el plugin hace lo mismo en
   `npm run dev` y `npm run preview`. Si se agrega una ruta nueva en App.tsx, va en los dos lugares. */
const APP_ROUTES = ["/login", "/register", "/recuperar-contrasena", "/checkout", "/cuenta", "/admin"];

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

// Se sirve en la raíz de byhyro.com (Cloudflare Pages compila la rama main con `npm run build`).
export default defineConfig({
  plugins: [react(), appRoutes()],
  server: { port: 5173 },
  build: {
    rolldownOptions: {
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app.html"),
      },
    },
  },
});
