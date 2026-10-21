// Importa un beacons.json (formato histórico) a la base de datos.
//
//   npm run import:beacons                          → server/prisma/data/beacons.json
//   npm run import:beacons -- ruta/al/archivo.json
//   npm run import:beacons -- --sobrescribir        → también actualiza los que ya existen
//
// Por defecto solo crea los beacons que faltan, para no pisar lo editado en el panel.
// Es idempotente: ejecutarlo dos veces no duplica nada.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadScriptEnv, SERVER_ROOT } from "../src/config/env.js";
import { createPrisma } from "../src/lib/prisma.js";
import { beaconKey, parseLegacyBeacons } from "../src/beacons/legacy-format.js";
import { writeBeaconSnapshot } from "../src/beacons/snapshot.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { sobrescribir: { type: "boolean", default: false } },
});

const env = loadScriptEnv();
const archivo = path.resolve(
  positionals[0] ?? path.join(SERVER_ROOT, "prisma", "data", "beacons.json"),
);
const db = createPrisma(env.DATABASE_URL);

try {
  console.log(`Leyendo ${archivo}`);
  const { beacons, errores } = parseLegacyBeacons(JSON.parse(await readFile(archivo, "utf-8")));
  for (const e of errores) console.warn(`  ⚠ Omitido ${e}`);

  let creados = 0;
  let actualizados = 0;
  let sinCambios = 0;
  for (const b of beacons) {
    const clave = beaconKey(b.major, b.minor);
    const existente = await db.beacon.findUnique({
      where: { major_minor: { major: b.major, minor: b.minor } },
    });
    if (!existente) {
      await db.beacon.create({ data: b });
      creados++;
      console.log(`  + ${clave} creado`);
    } else if (values.sobrescribir) {
      await db.beacon.update({ where: { id: existente.id }, data: b });
      actualizados++;
      console.log(`  ~ ${clave} actualizado`);
    } else {
      sinCambios++;
    }
  }

  await db.auditLog.create({
    data: {
      action: "BEACONS_IMPORT",
      entity: "Beacon",
      meta: {
        archivo: path.basename(archivo),
        creados,
        actualizados,
        sinCambios,
        omitidos: errores.length,
      },
    },
  });
  const total = await writeBeaconSnapshot(db, env.beaconSnapshotPath);

  const pista = values.sobrescribir ? "" : " (usa --sobrescribir para actualizarlos)";
  console.log(
    `\nListo: ${creados} creados, ${actualizados} actualizados, ` +
      `${sinCambios} ya existían${pista}, ${errores.length} omitidos.`,
  );
  console.log(`Snapshot local con ${total} beacons en ${env.beaconSnapshotPath}`);
  if (errores.length) process.exitCode = 1;
} finally {
  await db.$disconnect();
}
