// Cloudflare Pages solo sirve archivos reales: para que /web3/login y compañía abran la app al
// entrar directo o recargar, cada ruta del router lleva su propia copia de index.html.
import { copyFileSync, mkdirSync } from "node:fs";

const out = "dist-web3";
const routes = ["login", "register", "recuperar-contrasena", "cuenta"];

for (const route of routes) {
  mkdirSync(`${out}/${route}`, { recursive: true });
  copyFileSync(`${out}/index.html`, `${out}/${route}/index.html`);
}
console.log(`web3: ${routes.length} rutas del router copiadas en ${out}/`);
