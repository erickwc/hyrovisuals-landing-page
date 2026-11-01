import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "/" por defecto; para servirla en byhyro.com/web3 se compila con `npm run build:web3`.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
