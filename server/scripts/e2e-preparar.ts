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
  // Dirección y WhatsApp para recorrer el botón destacado y «Cómo llegar» de Contacto.
  await db.siteSettings.updateMany({
    data: {
      contactAddress: "Av. Libertador 1234, Santiago",
      socials: [{ red: "WhatsApp", url: "https://wa.me/56912345678" }],
    },
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
  // El boletín nace oculto (el equipo revisa antes los textos de consentimiento): se
  // muestra con sus textos iniciales para recorrerlo.
  await db.section.update({ where: { key: "boletin" }, data: { visible: true } });
  // Un ícono en la primera tarjeta de objetivos, para comprobar su contraste.
  const objetivos = await db.section.findUniqueOrThrow({ where: { key: "objetivos" } });
  const contenido = objetivos.content as { items: Record<string, unknown>[] };
  contenido.items[0] = { ...contenido.items[0], icono: "brujula" };
  await db.section.update({ where: { key: "objetivos" }, data: { content: contenido as object } });
  // Recursos de prueba: un PDF (el archivo no existe en disco, solo se comprueba el
  // enlace), un artículo con DOI y una guía en un repositorio externo.
  const pdf = await db.media.create({
    data: {
      storageKey: "documentos/e2e.pdf",
      url: "/uploads/documentos/e2e.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2_400_000,
      originalName: "informe.pdf",
    },
  });
  await db.resource.createMany({
    data: [
      {
        title: "Informe de impacto 2026",
        description: "Resultados del primer año de SIGNAL en espacios públicos.",
        kind: "REPORT",
        authors: "Equipo SIGNAL",
        publishedOn: new Date("2026-06-01T00:00:00Z"),
        license: "CC BY 4.0",
        fileId: pdf.id,
      },
      {
        title: "Navegación interior con balizas BLE",
        kind: "ARTICLE",
        authors: "Rojas, A.; Pérez, L.",
        publishedOn: new Date("2026-03-15T00:00:00Z"),
        doi: "10.1234/signal.2026.01",
      },
      {
        title: "Dossier de prensa SIGNAL",
        description: "Logotipos, fotos y datos clave del proyecto.",
        kind: "PRESS_KIT",
        publishedOn: new Date("2026-01-10T00:00:00Z"),
        externalUrl: "https://repositorio.example.cl/dossier",
      },
      {
        title: "Guía de instalación de beacons",
        kind: "GUIDE",
        externalUrl: "https://repositorio.example.cl/guia-instalacion",
      },
    ],
  });
  // El kit de prensa también nace oculto: se muestra con un contacto de prueba.
  await db.section.update({
    where: { key: "kit-prensa" },
    data: {
      visible: true,
      content: {
        titulo: "Kit de prensa",
        descripcion:
          "SIGNAL orienta por voz dentro de los edificios a personas con discapacidad visual.",
        contactoPrensa: "Ana Rojas, comunicaciones",
        correoPrensa: "prensa@signal.test",
      },
    },
  });
  console.log("Base de pruebas lista.");
} finally {
  await db.$disconnect();
}
