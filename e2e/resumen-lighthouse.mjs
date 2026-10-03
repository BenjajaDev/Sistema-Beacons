// Muestra los puntajes de Lighthouse CI (corrida representativa = mediana) de
// cada página, con el margen sobre el umbral. En GitHub Actions también los
// escribe en el resumen del job, para seguir la variabilidad entre corridas.
//
//   npm run lighthouse && node e2e/resumen-lighthouse.mjs

import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const UMBRALES = { performance: 90, accessibility: 95, "best-practices": 90, seo: 90 };
const NOMBRES = {
  performance: "Rendimiento",
  accessibility: "Accesibilidad",
  "best-practices": "Buenas prácticas",
  seo: "SEO",
};

let manifiesto;
try {
  manifiesto = JSON.parse(readFileSync(path.join(RAIZ, ".lighthouseci/manifest.json"), "utf8"));
} catch {
  // Si Lighthouse no llegó a generar informes, el error ya está en el paso anterior.
  console.warn("No hay .lighthouseci/manifest.json: ejecuta antes npm run lighthouse.");
  process.exit(0);
}

const categorias = Object.keys(UMBRALES);
const filas = manifiesto
  .filter((corrida) => corrida.isRepresentativeRun)
  .map((corrida) => {
    const pagina = new URL(corrida.url).pathname;
    const celdas = categorias.map((c) => {
      const puntaje = Math.round(corrida.summary[c] * 100);
      const margen = puntaje - UMBRALES[c];
      // El estado va en texto, no solo en un ícono.
      return `${puntaje} (${margen >= 0 ? "+" : ""}${margen}${margen < 0 ? ", bajo el umbral" : ""})`;
    });
    return `| ${pagina} | ${celdas.join(" | ")} |`;
  });

const tabla = [
  "### Lighthouse móvil (mediana de 3 corridas)",
  "",
  `| Página | ${categorias.map((c) => `${NOMBRES[c]} ≥ ${UMBRALES[c]}`).join(" | ")} |`,
  `| --- | ${categorias.map(() => "---").join(" | ")} |`,
  ...filas,
  "",
  "Entre paréntesis, el margen sobre el umbral.",
  "",
].join("\n");

console.log(tabla);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, tabla);
