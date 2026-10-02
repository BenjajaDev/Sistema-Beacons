// Crea un respaldo local completo de la base de datos y actualiza el snapshot de beacons.
//
//   npm run backup

import { loadServerEnv } from "../src/config/env.js";
import { createPrisma } from "../src/lib/prisma.js";
import { createBackup } from "../src/services/backup.js";
import { writeBeaconSnapshot } from "../src/beacons/snapshot.js";

const env = loadServerEnv();
const db = createPrisma(env.DATABASE_URL);
try {
  const archivo = await createBackup(db, env.backupDir, env.BACKUP_KEEP);
  const total = await writeBeaconSnapshot(db, env.beaconSnapshotPath);
  console.log(`Respaldo creado: ${archivo}`);
  console.log(`Snapshot de beacons (${total}): ${env.beaconSnapshotPath}`);
  console.log(`Se conservan los ${env.BACKUP_KEEP} respaldos más recientes.`);
} finally {
  await db.$disconnect();
}
