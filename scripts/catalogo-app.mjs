// Descarga el catálogo de beacons y lo guarda como la copia incluida en la APK
// (BeaconsAndroid/app/src/main/assets/catalogo-beacons.json). Con ella, la app
// orienta desde la primera vez que se abre, aunque no haya internet.
//
//   npm run catalogo:app                         # desde producción
//   npm run catalogo:app -- http://localhost:3000  # desde el servidor local
//
// Ejecútalo antes de generar cada APK de release.

import { writeFile, rename } from "node:fs/promises";
import path from "node:path";

const PRODUCCION = "https://proyectosignal.pages.dev";
const DESTINO = path.resolve(
  import.meta.dirname,
  "../BeaconsAndroid/app/src/main/assets/catalogo-beacons.json",
);
const MAX_ID = 65535;

function fallar(mensaje) {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

const origen = (process.argv[2] ?? PRODUCCION).replace(/\/$/, "");
if (!URL.canParse(origen)) fallar(`«${origen}» no es una URL válida.`);
const url = `${origen}/api/public/beacons`;

let respuesta;
try {
  // Render gratis puede tardar ~1 min en despertar.
  respuesta = await fetch(url, { signal: AbortSignal.timeout(90_000) });
} catch (err) {
  fallar(`No se pudo conectar con ${url}: ${err.message}`);
}
if (!respuesta.ok) fallar(`${url} respondió ${respuesta.status}.`);

const { version, beacons } = await respuesta.json();
const esId = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_ID;
const esTexto = (t) => typeof t === "string" && t.trim().length > 0;
if (!esTexto(version) || !Array.isArray(beacons)) {
  fallar("La respuesta no tiene la forma { version, beacons }.");
}
const invalidas = beacons.filter(
  (b) => !esId(b.major) || !esId(b.minor) || !esTexto(b.titulo) || !esTexto(b.descripcion),
);
if (invalidas.length) fallar(`Hay ${invalidas.length} fichas incompletas: corrígelas en el panel.`);

const copia = { version, generadoEn: new Date().toISOString(), beacons };
// Escritura atómica: si se corta a mitad, la copia anterior queda intacta.
await writeFile(`${DESTINO}.tmp`, JSON.stringify(copia, null, 2) + "\n", "utf-8");
await rename(`${DESTINO}.tmp`, DESTINO);
console.log(
  `✓ ${beacons.length} fichas (versión ${version}) en ${path.relative(process.cwd(), DESTINO)}`,
);
