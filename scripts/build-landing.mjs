/* Compila la landing de Astro (landing/) y la junta con la app de React en dist/.
   Va después de `vite build` (que vacía dist/ y deja app.html con sus archivos):
   1. instala las dependencias de landing/ si faltan (en Cloudflare Pages el repo llega sin node_modules),
   2. compila Astro con las variables de Supabase de .env.production (las mismas de la app),
   3. quita de dist/ la landing anterior (public/landing/) menos las fuentes e imágenes que usa la app,
   4. copia landing/dist/ a dist/: la raíz (/) y /en/ quedan servidas por Astro. */
import { execSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const landing = resolve(root, "landing");
const dist = resolve(root, "dist");
const run = (cmd) => execSync(cmd, { cwd: landing, stdio: "inherit", env });

// variables públicas: VITE_SUPABASE_* de la app → PUBLIC_SUPABASE_* de Astro (si no vienen ya definidas)
const env = { ...process.env };
for (const line of readFileSync(resolve(root, ".env.production"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^VITE_(SUPABASE_[A-Z_]+)=(.*)$/);
  if (m && !env[`PUBLIC_${m[1]}`]) env[`PUBLIC_${m[1]}`] = m[2].trim();
}

if (!existsSync(resolve(landing, "node_modules"))) run("npm ci --no-audit --no-fund");
run("npm run build");

// la landing anterior ya no se publica; la app sigue usando /landing/fonts y /landing/img
const old = resolve(dist, "landing");
if (existsSync(old)) {
  for (const name of readdirSync(old)) if (name !== "fonts" && name !== "img") rmSync(resolve(old, name), { recursive: true, force: true });
}

// _headers y _redirects salen de public/ de la raíz (las rutas de la app y la política de seguridad son de las dos)
const out = resolve(landing, "dist");
const skip = new Set(["_headers", "_redirects"].map((f) => resolve(out, f)));
cpSync(out, dist, { recursive: true, force: true, filter: (src) => !skip.has(resolve(src)) });
console.log("Landing de Astro copiada a dist/");
