// Completa el build de la landing (apps/web/dist/public) para Cloudflare Pages:
// agrega 404.html y sin-servidor.html, derivadas de offline.html.
//
//   npm run build:pages   (desde la raíz: compila la landing y luego corre esto)

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { derivarPagina, PAGINA_404, PAGINA_SIN_SERVIDOR } from "../src/pages-files.ts";

const PUBLICO = path.resolve(import.meta.dirname, "../../web/dist/public");

let plantilla: string;
try {
  plantilla = await readFile(path.join(PUBLICO, "offline.html"), "utf-8");
} catch {
  throw new Error(
    "No existe apps/web/dist/public/offline.html. Compila antes la landing: npm run build -w apps/web",
  );
}

for (const pagina of [PAGINA_404, PAGINA_SIN_SERVIDOR]) {
  await writeFile(path.join(PUBLICO, pagina.archivo), derivarPagina(plantilla, pagina));
}
console.log(
  `✓ dist/public listo para Cloudflare Pages (${PAGINA_404.archivo}, ${PAGINA_SIN_SERVIDOR.archivo}).`,
);
