import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Se sirve en la raíz de byhyro.com (Cloudflare Pages compila la rama main con `npm run build`).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
