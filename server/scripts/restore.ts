// Restaura la base de datos desde un respaldo local. REEMPLAZA todo el contenido.
//
//   npm run restore                          → lista los respaldos disponibles
//   npm run restore -- <archivo>             → muestra qué contiene, sin tocar nada
//   npm run restore -- <archivo> --confirmar
//
// Antes de restaurar se crea un respaldo del estado actual, por si hay que volver atrás.

import path from "node:path";
import { parseArgs } from "node:util";
import { loadServerEnv } from "../src/config/env.js";
import { createPrisma } from "../src/lib/prisma.js";
import { createBackup, listBackups, readBackup, restoreDatabase } from "../src/services/backup.js";
import { writeBeaconSnapshot } from "../src/beacons/snapshot.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { confirmar: { type: "boolean", default: false } },
});
const env = loadServerEnv();

if (!positionals[0]) {
  const archivos = await listBackups(env.backupDir);
  if (!archivos.length) {
    console.log(`No hay respaldos en ${env.backupDir}. Crea uno con: npm run backup`);
  } else {
    console.log(`Respaldos en ${env.backupDir} (del más antiguo al más reciente):`);
    for (const f of archivos) console.log(`  ${f}`);
    console.log("\nPara ver uno: npm run restore -- <archivo>");
  }
  process.exit(0);
}

const archivo = path.resolve(env.backupDir, positionals[0]);
const respaldo = await readBackup(archivo);
console.log(`Respaldo del ${respaldo.createdAt}:`);
for (const [tabla, filas] of Object.entries(respaldo.data))
  console.log(`  ${tabla}: ${filas.length}`);

if (!values.confirmar) {
  console.log(
    "\nNo se cambió nada. Para reemplazar la base de datos con este respaldo, agrega --confirmar.",
  );
  process.exit(0);
}

const db = createPrisma(env.DATABASE_URL);
try {
  // keep + 1 para que este respaldo de seguridad no desplace al que se va a restaurar.
  const previo = await createBackup(db, env.backupDir, env.BACKUP_KEEP + 1);
  console.log(`\nEstado actual respaldado en ${previo}`);
  const conteo = await restoreDatabase(db, respaldo);
  await writeBeaconSnapshot(db, env.beaconSnapshotPath);
  console.log("Restauración completa:", conteo);
} finally {
  await db.$disconnect();
}
