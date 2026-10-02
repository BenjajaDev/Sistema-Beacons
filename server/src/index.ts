import { loadServerEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { createPrisma } from "./lib/prisma.js";
import { createApp } from "./app.js";
import { prismaBeaconReader, snapshotBeaconReader } from "./beacons/store.js";
import { writeBeaconSnapshot } from "./beacons/snapshot.js";
import { createBackup } from "./services/backup.js";

const env = loadServerEnv();
const db = createPrisma(env.DATABASE_URL);

const app = createApp({
  logger,
  beacons: {
    primary: prismaBeaconReader(db),
    fallback: snapshotBeaconReader(env.beaconSnapshotPath),
  },
  pingDb: async () => {
    await db.$queryRaw`SELECT 1`;
  },
});

// Refresca el snapshot al arrancar. Si la base no responde, se conserva el último.
try {
  const total = await writeBeaconSnapshot(db, env.beaconSnapshotPath);
  logger.info({ total, ruta: env.beaconSnapshotPath }, "Snapshot de beacons actualizado");
} catch (err) {
  logger.warn({ err }, "No se pudo actualizar el snapshot de beacons; se mantiene el anterior");
}

if (env.BACKUP_INTERVAL_HOURS > 0) {
  const respaldar = async () => {
    try {
      const archivo = await createBackup(db, env.backupDir, env.BACKUP_KEEP);
      await writeBeaconSnapshot(db, env.beaconSnapshotPath);
      logger.info({ archivo }, "Respaldo automático creado");
    } catch (err) {
      logger.error({ err }, "Falló el respaldo automático");
    }
  };
  setInterval(respaldar, env.BACKUP_INTERVAL_HOURS * 3_600_000).unref();
}

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(`Servidor SIGNAL en http://localhost:${env.PORT}`);
  logger.info(`Prueba de la app: http://localhost:${env.PORT}/beacons/1/1`);
});

async function apagar(senal: string) {
  logger.info({ senal }, "Deteniendo el servidor");
  server.close();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void apagar("SIGINT"));
process.on("SIGTERM", () => void apagar("SIGTERM"));
