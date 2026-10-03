import path from "node:path";
import { z } from "zod";

// Raíz del paquete del servidor (server/). Las rutas relativas del .env se
// resuelven desde aquí, no desde el directorio de trabajo.
export const SERVER_ROOT = path.resolve(import.meta.dirname, "..", "..");

// z.coerce.boolean() convierte "false" en true; esto acepta solo "true" o "false".
const booleano = (porDefecto: boolean) =>
  z
    .enum(["true", "false"])
    .default(porDefecto ? "true" : "false")
    .transform((v) => v === "true");

const lista = z
  .string()
  .default("")
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

const secreto = (nombre: string) =>
  z
    .string(`Falta ${nombre}.`)
    .min(32, `${nombre} debe tener al menos 32 caracteres. Genera uno con: npm run secret`);

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().default("0.0.0.0"),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "silent"]).default("info"),
    DATABASE_URL: z.string().min(1, "Falta DATABASE_URL (ver server/.env.example)."),

    // --- Panel y sesión ---
    ADMIN_PATH: z
      .string("Falta ADMIN_PATH.")
      .regex(
        /^[A-Za-z0-9_-]{24,128}$/,
        "ADMIN_PATH debe tener entre 24 y 128 caracteres: letras, números, - o _. Genera uno con: npm run secret",
      ),
    ADMIN_DIST_DIR: z.string().default("../apps/web/dist/admin"),
    PUBLIC_DIST_DIR: z.string().default("../apps/web/dist/public"),
    // URL pública del sitio (https://...) para el sitemap, el canonical y Open Graph.
    // Sin ella se usa el host de cada petición.
    SITE_URL: z
      .url("SITE_URL debe ser una URL completa, por ejemplo https://signal.cl.")
      .optional(),
    JWT_SECRET: secreto("JWT_SECRET"),
    CSRF_SECRET: secreto("CSRF_SECRET"),
    SESSION_TTL_HOURS: z.coerce.number().min(0.25).max(72).default(8),
    COOKIE_SECURE: booleano(true),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
    LOGIN_LOCK_MINUTES: z.coerce.number().min(1).default(15),
    LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).default(20),
    API_RATE_LIMIT: z.coerce.number().int().min(1).default(300),

    // --- Red ---
    CORS_ORIGINS: lista,
    TRUST_PROXY: z.string().default("false"),
    CSP_IMG_HOSTS: lista,

    // --- Imágenes subidas ---
    STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
    UPLOAD_DIR: z.string().default("uploads"),
    UPLOAD_MAX_MB: z.coerce.number().min(0.1).max(50).default(5),
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
    SUPABASE_BUCKET: z.string().default("media"),

    // --- Respaldos ---
    BACKUP_DIR: z.string().default("backups"),
    BACKUP_INTERVAL_HOURS: z.coerce.number().min(0).default(24),
    BACKUP_KEEP: z.coerce.number().int().min(1).default(14),
    BEACON_SNAPSHOT_PATH: z.string().default("backups/beacons.snapshot.json"),
  })
  .refine((e) => e.NODE_ENV !== "production" || e.COOKIE_SECURE, {
    path: ["COOKIE_SECURE"],
    message:
      "En producción las cookies deben ser Secure (COOKIE_SECURE=true) y el sitio servirse por HTTPS.",
  })
  .refine(
    (e) => e.STORAGE_DRIVER !== "supabase" || (e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY),
    {
      path: ["STORAGE_DRIVER"],
      message:
        "Con STORAGE_DRIVER=supabase hay que definir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    },
  )
  .refine((e) => e.JWT_SECRET !== e.CSRF_SECRET, {
    path: ["CSRF_SECRET"],
    message: "CSRF_SECRET debe ser distinto de JWT_SECRET.",
  });

type ParsedEnv = z.infer<typeof serverEnvSchema>;

export type ServerEnv = ParsedEnv & {
  isProduction: boolean;
  adminDistDir: string;
  publicDistDir: string;
  backupDir: string;
  beaconSnapshotPath: string;
  // Valor listo para app.set("trust proxy", ...).
  trustProxy: boolean | number | string;
  uploadDir: string;
  // Hosts de imágenes para la CSP, incluido Supabase Storage si se usa.
  imgHosts: string[];
};

function parseTrustProxy(valor: string): boolean | number | string {
  if (valor === "true") return true;
  if (valor === "false") return false;
  if (/^\d+$/.test(valor)) return Number(valor);
  return valor;
}

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
    isProduction: env.NODE_ENV === "production",
    adminDistDir: path.resolve(SERVER_ROOT, env.ADMIN_DIST_DIR),
    publicDistDir: path.resolve(SERVER_ROOT, env.PUBLIC_DIST_DIR),
    backupDir: path.resolve(SERVER_ROOT, env.BACKUP_DIR),
    beaconSnapshotPath: path.resolve(SERVER_ROOT, env.BEACON_SNAPSHOT_PATH),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    uploadDir: path.resolve(SERVER_ROOT, env.UPLOAD_DIR),
    imgHosts: [
      ...env.CSP_IMG_HOSTS,
      ...(env.STORAGE_DRIVER === "supabase" && env.SUPABASE_URL
        ? [new URL(env.SUPABASE_URL).origin]
        : []),
    ],
  };
}

// Los scripts (seed, importación, respaldos) solo necesitan la base de datos:
// no deben exigir los secretos del panel.
const scriptEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "Falta DATABASE_URL (ver server/.env.example)."),
  BACKUP_DIR: z.string().default("backups"),
  BACKUP_KEEP: z.coerce.number().int().min(1).default(14),
  BEACON_SNAPSHOT_PATH: z.string().default("backups/beacons.snapshot.json"),
});

export function loadScriptEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = scriptEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Configuración inválida en server/.env:\n${parsed.error.issues.map((i) => `  - ${i.message}`).join("\n")}`,
    );
  }
  const env = parsed.data;
  return {
    ...env,
    backupDir: path.resolve(SERVER_ROOT, env.BACKUP_DIR),
    beaconSnapshotPath: path.resolve(SERVER_ROOT, env.BEACON_SNAPSHOT_PATH),
  };
}
