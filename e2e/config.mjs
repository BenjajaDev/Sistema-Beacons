// Configuración compartida de las pruebas de punta a punta (Playwright y Lighthouse CI).

export const PUERTO = 3100;
export const BASE = `http://localhost:${PUERTO}`;
export const ADMIN_PATH = "panel-e2e-0123456789abcdefghij";
export const PANEL = `${BASE}/${ADMIN_PATH}`;

export const CUENTAS = {
  admin: { email: "admin@e2e.test", clave: "Clave-E2E-Admin-2026" },
  editor: { email: "editor@e2e.test", clave: "Clave-E2E-Editor-2026" },
};

// Entorno del servidor de pruebas: base signal_test, ruta y secretos de prueba.
export function entornoServidor(databaseUrl) {
  return {
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: String(PUERTO),
    LOG_LEVEL: "warn",
    DATABASE_URL: databaseUrl,
    ADMIN_PATH,
    JWT_SECRET: "e2e-jwt-secreto-0123456789abcdefghijklmn",
    CSRF_SECRET: "e2e-csrf-secreto-0123456789abcdefghijklm",
    COOKIE_SECURE: "true",
    LOGIN_RATE_LIMIT: "1000",
    API_RATE_LIMIT: "10000",
    BACKUP_INTERVAL_HOURS: "0",
    UPLOAD_DIR: ".e2e-uploads",
    BEACON_SNAPSHOT_PATH: ".e2e-snapshot.json",
    SITE_URL: "",
  };
}
