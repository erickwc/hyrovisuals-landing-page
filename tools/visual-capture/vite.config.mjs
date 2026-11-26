import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/* Grabador de gráficas (solo local, no se publica). Lee el código del programa desde su carpeta, sin escribir nada
   ahí, y guarda las grabaciones en public/landing/traces de esta web. */
const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../..");
const program = resolve(web, "../Hyro visual");
const player = resolve(web, "public/landing/js");
const traces = resolve(web, "public/landing/traces");
const reports = here;

const saveRecordings = {
  name: "save-recordings",
  configureServer(server) {
    server.middlewares.use("/save", (req, res) => {
      const name = new URL(req.url, "http://local").searchParams.get("name") ?? "";
      if (req.method !== "POST" || !/^[a-z0-9-]+\.(hvt|json)$/.test(name)) {
        res.statusCode = 400;
        return res.end("nombre inválido");
      }
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const output = name.endsWith(".hvt") ? traces : reports;
        mkdirSync(output, { recursive: true });
        writeFileSync(resolve(output, name), Buffer.concat(chunks));
        res.end("ok");
      });
    });
  },
};

/* Cuadros PNG de las gráficas que van como video (las de miles de puntos): frames/<nombre>/<número>.png */
const saveFrames = {
  name: "save-frames",
  configureServer(server) {
    server.middlewares.use("/frame", (req, res) => {
      const params = new URL(req.url, "http://local").searchParams;
      const name = params.get("name") ?? "", n = params.get("n") ?? "";
      if (req.method !== "POST" || !/^[a-z0-9-]+$/.test(name) || !/^\d{4}$/.test(n)) {
        res.statusCode = 400;
        return res.end("nombre inválido");
      }
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const dir = resolve(here, "frames", name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, n + ".png"), Buffer.concat(chunks));
        res.end("ok");
      });
    });
  },
};

export default defineConfig({
  root: here,
  publicDir: false,
  cacheDir: resolve(web, "node_modules/.vite-capture"),
  define: { __APP_VERSION__: JSON.stringify("capture") },
  resolve: { alias: { "@hyro": program, "@player": player } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { port: 5190, strictPort: true, fs: { allow: [here, program, player] } },
  plugins: [saveRecordings, saveFrames],
});
