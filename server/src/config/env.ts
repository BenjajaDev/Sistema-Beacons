import path from "node:path";
import { z } from "zod";

// Raíz del paquete del servidor (server/). Las rutas relativas del .env se
// resuelven desde aquí, no desde el directorio de trabajo.
export const SERVER_ROOT = path.resolve(import.meta.dirname, "..", "..");

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1, "Falta DATABASE_URL (ver server/.env.example)."),
  BACKUP_DIR: z.string().default("backups"),
  BACKUP_INTERVAL_HOURS: z.coerce.number().min(0).default(24),
  BACKUP_KEEP: z.coerce.number().int().min(1).default(14),
  BEACON_SNAPSHOT_PATH: z.string().default("backups/beacons.snapshot.json"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  backupDir: string;
  beaconSnapshotPath: string;
};

// Valida el entorno de una vez al arrancar y corta con un mensaje claro si
// falta algo, en vez de fallar más tarde en una petición.
export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuración inválida en server/.env:\n${detalle}`);
  }
  const env = parsed.data;
  return {
    ...env,
    backupDir: path.resolve(SERVER_ROOT, env.BACKUP_DIR),
    beaconSnapshotPath: path.resolve(SERVER_ROOT, env.BEACON_SNAPSHOT_PATH),
  };
}
