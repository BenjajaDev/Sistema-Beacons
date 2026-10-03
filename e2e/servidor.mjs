// Prepara la base de pruebas y arranca el servidor de pruebas en el puerto 3100.
// Lo usan Playwright (webServer) y Lighthouse CI (startServerCommand).
//
//   node e2e/servidor.mjs
//
// Requiere TEST_DATABASE_URL (en server/.env o en el entorno) y el frontend
// compilado (npm run build -w apps/web).

import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { BASE, entornoServidor } from "./config.mjs";

const RAIZ = path.resolve(import.meta.dirname, "..");
const SERVIDOR = path.join(RAIZ, "server");
try {
  process.loadEnvFile(path.join(SERVIDOR, ".env"));
} catch {
  // En CI las variables vienen del entorno.
}

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("Falta TEST_DATABASE_URL (base de pruebas cuyo nombre termina en _test).");
  process.exit(1);
}
if (!existsSync(path.join(RAIZ, "apps/web/dist/public/index.html"))) {
  console.error("Falta el build del frontend. Ejecuta antes: npm run build -w apps/web");
  process.exit(1);
}

if (!new URL(url).pathname.endsWith("_test")) {
  console.error("TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test.");
  process.exit(1);
}

const env = { ...process.env, ...entornoServidor(url) };
delete env.SITE_URL;

// Migraciones pendientes (idempotente). DIRECT_URL se fija a la base de pruebas
// para que nunca se use la de server/.env (Supabase en producción).
execSync("npx prisma migrate deploy", {
  cwd: SERVIDOR,
  env: { ...env, DIRECT_URL: url },
  stdio: "inherit",
});

// La base se vacía y se carga con el contenido inicial y dos cuentas de prueba.
execSync("npx tsx scripts/e2e-preparar.ts", { cwd: SERVIDOR, env, stdio: "inherit" });

const hijo = spawn("npx tsx src/index.ts", { cwd: SERVIDOR, env, stdio: "inherit", shell: true });
const terminar = () => hijo.kill();
process.on("SIGINT", terminar);
process.on("SIGTERM", terminar);
hijo.on("exit", (codigo) => process.exit(codigo ?? 0));

// Aviso de «listo» (lo espera Lighthouse CI) cuando el servidor responde.
for (let i = 0; i < 120; i++) {
  try {
    if ((await fetch(`${BASE}/api/health`)).ok) {
      console.log("Servidor de pruebas listo en", BASE);
      break;
    }
  } catch {
    // Aún arrancando.
  }
  await new Promise((r) => setTimeout(r, 500));
}
