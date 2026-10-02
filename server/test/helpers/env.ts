import path from "node:path";
import { loadServerEnv } from "../../src/config/env.js";

export const TEST_ADMIN_PATH = "panel-de-prueba-0123456789abcdef";
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

// Entorno de test explícito: no hereda el server/.env de quien ejecuta las pruebas.
export function testEnv(overrides: Record<string, string> = {}) {
  return loadServerEnv({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    DATABASE_URL: TEST_DATABASE_URL ?? "postgresql://sin-base/ninguna",
    ADMIN_PATH: TEST_ADMIN_PATH,
    ADMIN_DIST_DIR: path.resolve(import.meta.dirname, "../fixtures/admin-dist"),
    JWT_SECRET: "jwt-secreto-de-prueba-0123456789abcdef0123",
    CSRF_SECRET: "csrf-secreto-de-prueba-0123456789abcdef012",
    COOKIE_SECURE: "true",
    BACKUP_INTERVAL_HOURS: "0",
    ...overrides,
  });
}
