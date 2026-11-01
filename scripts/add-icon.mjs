// Agrega un icono de Animate UI (Hugeicons) al proyecto.
//   node scripts/add-icon.mjs arrow-right-02 [más-iconos...]
// El catálogo está en https://animate-ui.com/docs/icons/hugeicons. El paquete @animate-ui/react pide
// React 19, así que el núcleo vive copiado en src/components/animate-ui/icons/icon.tsx y cada icono
// se baja del registro y se ajusta a ese núcleo.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const dir = "src/components/animate-ui/icons/hugeicons";
const names = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const force = process.argv.includes("--force");

if (names.length === 0) {
  console.error("Uso: node scripts/add-icon.mjs <nombre> [<nombre>...]   (ej. arrow-right-02)");
  process.exit(1);
}

mkdirSync(dir, { recursive: true });
let failed = false;

for (const name of names) {
  const file = `${dir}/${name}.tsx`;
  if (existsSync(file) && !force) {
    console.log(`= ${name}: ya existe (usa --force para reemplazarlo)`);
    continue;
  }
  const res = await fetch(`https://animate-ui.com/r/icons-hugeicons-${name}.json`);
  if (!res.ok) {
    console.error(`x ${name}: no existe en el registro (${res.status}). Revisa el nombre en la documentación.`);
    failed = true;
    continue;
  }
  const { files } = await res.json();
  const code = files[0].content.replace("@animate-ui/react/icons", "../icon").replace("import * as React from 'react';\n", "");
  writeFileSync(file, code);
  console.log(`+ ${name}: ${file}`);
}

process.exit(failed ? 1 : 0);
