// Prepara la base de pruebas para la verificación de punta a punta (temporal).
process.loadEnvFile(".env");
const { testDb, resetDb, seedContent, createUser } = await import("../test/helpers/db.js");
const db = testDb();
await resetDb(db);
await seedContent(db);
await createUser(db, { email: "admin@e2e.test", password: "Clave-E2E-Admin-2026", role: "ADMIN" });
await createUser(db, {
  email: "editor@e2e.test",
  password: "Clave-E2E-Editor-2026",
  role: "EDITOR",
});
await db.$disconnect();
