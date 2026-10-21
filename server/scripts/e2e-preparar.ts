// Vacía la base de pruebas (TEST_DATABASE_URL) y carga el contenido inicial y dos
// cuentas de prueba sin cambio de contraseña pendiente. Lo usa e2e/servidor.mjs.

try {
  process.loadEnvFile(".env");
} catch {
  // En CI las variables vienen del entorno.
}
const { testDb, resetDb, seedContent, createUser } = await import("../test/helpers/db.js");
const db = testDb();
try {
  await resetDb(db);
  await seedContent(db);
  await createUser(db, {
    email: "admin@e2e.test",
    password: "Clave-E2E-Admin-2026",
    role: "ADMIN",
  });
  await createUser(db, {
    email: "editor@e2e.test",
    password: "Clave-E2E-Editor-2026",
    role: "EDITOR",
  });
  // Cinco personas para probar la fila del equipo y su card desplegable.
  const equipo = ["Ana Rojas", "Luis Pérez", "Sofía Díaz", "Pedro Soto", "Valentina Muñoz"];
  await db.teamMember.createMany({
    data: equipo.map((name, i) => ({
      name,
      position: i === 0 ? "Coordinación" : "Desarrollo",
      area: "Ingeniería",
      education: "Universidad de Chile",
      bio: "Prueba los mensajes de voz junto a personas usuarias.",
      email: `persona${i + 1}@e2e.test`,
      links: [{ red: "LinkedIn", url: `https://www.linkedin.com/in/persona-${i + 1}` }],
      order: i + 1,
    })),
  });
  console.log("Base de pruebas lista.");
} finally {
  await db.$disconnect();
}
