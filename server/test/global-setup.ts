import { execSync } from "node:child_process";
import path from "node:path";
import { createPrisma } from "../src/lib/prisma.js";

// Deja la base de pruebas recién migrada una sola vez por ejecución.
// Como borra el schema, solo acepta bases cuyo nombre termina en _test.
export default async function setup() {
  try {
    process.loadEnvFile(path.resolve(import.meta.dirname, "../.env"));
  } catch {
    // Sin .env: en CI las variables vienen del entorno.
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test.");
  }
  const db = createPrisma(url);
  try {
    await db.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await db.$executeRawUnsafe("CREATE SCHEMA public");
  } finally {
    await db.$disconnect();
  }
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: "pipe",
  });
}
