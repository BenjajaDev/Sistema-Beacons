// Verifica que el build público (dist/public) no contenga NADA del panel:
// ni su código, ni sus rutas de API, ni la ruta secreta. Corre en CI tras el build.
//
//   node scripts/check-public-bundle.mjs
//
// Si falla, algo de src/admin se importó desde la landing o el service worker
// quedó apuntando al panel. El mensaje indica el archivo y el texto encontrado.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const PUBLICO = path.join(RAIZ, "dist/public");
const PANEL = path.join(RAIZ, "dist/admin");
const MARCADOR = "__SIGNAL_PANEL__";

// La ruta secreta, si está disponible (variable de entorno o server/.env local).
function adminPath() {
  if (process.env.ADMIN_PATH) return process.env.ADMIN_PATH;
  const env = path.resolve(RAIZ, "../../server/.env");
  if (!existsSync(env)) return null;
  const linea = readFileSync(env, "utf-8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("ADMIN_PATH="));
  return (
    linea
      ?.slice("ADMIN_PATH=".length)
      .replace(/^["']|["']$/g, "")
      .trim() || null
  );
}

const PROHIBIDO = [
  [MARCADOR, "código del panel (marcador de src/admin)"],
  ["/api/admin", "llamadas a la API del panel"],
  ["admin.html", "referencia a la entrada del panel"],
  ["src/admin", "ruta de código fuente del panel"],
  ["X-CSRF-Token", "cabecera CSRF (solo la usa el panel)"],
  ["change-password", "flujo de contraseña del panel"],
];
const secreta = adminPath();
if (secreta) PROHIBIDO.push([secreta, "la ruta secreta ADMIN_PATH"]);

const TEXTO = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".webmanifest",
  ".txt",
  ".xml",
  ".svg",
]);

function archivos(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = path.join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

const fallas = [];

if (!existsSync(PUBLICO)) {
  console.error("No existe dist/public. Ejecuta primero `npm run build:public`.");
  process.exit(1);
}

for (const archivo of archivos(PUBLICO)) {
  const relativo = path.relative(RAIZ, archivo).replaceAll("\\", "/");
  if (archivo.endsWith(".map")) {
    fallas.push(`${relativo}: los source maps no se publican (exponen el código fuente).`);
    continue;
  }
  if (/admin/i.test(path.basename(archivo))) {
    fallas.push(`${relativo}: un archivo del build público se llama como el panel.`);
  }
  if (!TEXTO.has(path.extname(archivo))) continue;
  const contenido = readFileSync(archivo, "utf-8");
  for (const [patron, motivo] of PROHIBIDO) {
    if (contenido.includes(patron)) fallas.push(`${relativo}: contiene ${motivo}.`);
  }
}

// Control del control: si el marcador no está en el build del panel, esta
// verificación no estaría probando nada.
if (existsSync(PANEL)) {
  const tieneMarcador = archivos(PANEL).some(
    (a) => a.endsWith(".js") && readFileSync(a, "utf-8").includes(MARCADOR),
  );
  if (!tieneMarcador) {
    fallas.push(`dist/admin no contiene el marcador ${MARCADOR}: revisa src/admin/marker.ts.`);
  }
}

if (fallas.length) {
  console.error("✗ El bundle público contiene referencias al panel:\n");
  for (const f of fallas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `✓ dist/public no contiene referencias al panel (${PROHIBIDO.length} patrones${secreta ? ", incluida la ruta secreta" : ""}).`,
);
