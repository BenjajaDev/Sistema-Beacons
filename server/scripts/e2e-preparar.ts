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
  await createUser(db, {
    email: "social@e2e.test",
    password: "Clave-E2E-Social-2026",
    role: "SOCIAL",
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
  // «En cifras» y la línea de tiempo nacen ocultas: se publican con datos de prueba
  // (los números no son reales) para que axe y las capturas las recorran.
  await db.section.update({
    where: { key: "cifras" },
    data: {
      visible: true,
      content: {
        titulo: "SIGNAL en cifras",
        intro: "Datos de prueba.",
        items: [
          { valor: 12, etiqueta: "Talleres realizados" },
          {
            valor: 1250,
            sufijo: "+",
            etiqueta: "Personas beneficiadas",
            detalle: "Dato de prueba",
          },
          { valor: 80, sufijo: "%", etiqueta: "Satisfacción" },
        ],
      },
    },
  });
  await db.section.update({
    where: { key: "hitos" },
    data: {
      visible: true,
      content: {
        titulo: "Ruta del proyecto",
        items: [
          { titulo: "Piloto", texto: "Probado en terreno.", estado: "hecho", fecha: "2025" },
          { titulo: "Ajustes", texto: "Mejoras con las personas usuarias.", estado: "en-curso" },
          { titulo: "Ampliación", texto: "Más espacios.", estado: "futuro", fecha: "2027" },
        ],
      },
    },
  });
  // Un ícono en la primera tarjeta de objetivos, para comprobar su contraste.
  const objetivos = await db.section.findUniqueOrThrow({ where: { key: "objetivos" } });
  const contenido = objetivos.content as { items: Record<string, unknown>[] };
  contenido.items[0] = { ...contenido.items[0], icono: "brujula" };
  await db.section.update({ where: { key: "objetivos" }, data: { content: contenido as object } });
  console.log("Base de pruebas lista.");
} finally {
  await db.$disconnect();
}
