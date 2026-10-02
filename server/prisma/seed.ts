// Crea las cuentas iniciales, la configuración del sitio y las secciones de la landing.
//
//   npm run seed
//
// Idempotente: solo crea lo que falta. Si una cuenta ya existe, NO cambia su
// contraseña ni su rol; si una sección ya existe, NO pisa su contenido.

import { z } from "zod";
import { loadServerEnv } from "../src/config/env.js";
import { createPrisma } from "../src/lib/prisma.js";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../src/auth/password.js";
import { DEFAULT_SITE_SETTINGS } from "../src/content/settings.js";
import { SECTION_DEFINITIONS, sectionSchemas, type SectionKey } from "../src/content/sections.js";

const email = (nombre: string) => z.email(`${nombre} debe ser un correo válido.`);
const password = (nombre: string) =>
  z
    .string(`Falta ${nombre}.`)
    .min(PASSWORD_MIN_LENGTH, `${nombre} debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);

const seedEnv = z
  .object({
    SEED_ADMIN_EMAIL: email("SEED_ADMIN_EMAIL"),
    SEED_ADMIN_PASSWORD: password("SEED_ADMIN_PASSWORD"),
    SEED_ADMIN_NAME: z.string().trim().min(1).default("Administración"),
    SEED_EDITOR_EMAIL: email("SEED_EDITOR_EMAIL"),
    SEED_EDITOR_PASSWORD: password("SEED_EDITOR_PASSWORD"),
    SEED_EDITOR_NAME: z.string().trim().min(1).default("Equipo editorial"),
  })
  .refine((e) => e.SEED_ADMIN_EMAIL.toLowerCase() !== e.SEED_EDITOR_EMAIL.toLowerCase(), {
    message: "SEED_ADMIN_EMAIL y SEED_EDITOR_EMAIL deben ser distintos.",
  })
  .safeParse(process.env);

if (!seedEnv.success) {
  console.error("No se puede ejecutar el seed. Revisa server/.env:");
  for (const i of seedEnv.error.issues) console.error(`  - ${i.message}`);
  process.exit(1);
}
const s = seedEnv.data;

const env = loadServerEnv();
const db = createPrisma(env.DATABASE_URL);

const cuentas = [
  {
    email: s.SEED_ADMIN_EMAIL,
    password: s.SEED_ADMIN_PASSWORD,
    name: s.SEED_ADMIN_NAME,
    role: "ADMIN",
  },
  {
    email: s.SEED_EDITOR_EMAIL,
    password: s.SEED_EDITOR_PASSWORD,
    name: s.SEED_EDITOR_NAME,
    role: "EDITOR",
  },
] as const;

try {
  console.log("Cuentas:");
  for (const c of cuentas) {
    const correo = c.email.trim().toLowerCase();
    const existente = await db.user.findUnique({ where: { email: correo } });
    if (existente) {
      console.log(`  = ${correo} ya existe (${existente.role}); sin cambios.`);
      continue;
    }
    const user = await db.user.create({
      data: {
        email: correo,
        name: c.name,
        role: c.role,
        passwordHash: await hashPassword(c.password),
        mustChangePassword: true,
      },
    });
    await db.auditLog.create({
      data: {
        action: "USER_CREATE",
        entity: "User",
        entityId: user.id,
        meta: { origen: "seed", role: c.role },
      },
    });
    console.log(`  + ${correo} creado como ${c.role}. Deberá cambiar la contraseña al entrar.`);
  }

  const ajustes = await db.siteSettings.findUnique({ where: { id: 1 } });
  if (ajustes) {
    console.log("Configuración del sitio: ya existe; sin cambios.");
  } else {
    await db.siteSettings.create({ data: DEFAULT_SITE_SETTINGS });
    console.log("Configuración del sitio: creada con la paleta y tipografías por defecto.");
  }

  console.log("Secciones:");
  for (const key of Object.keys(SECTION_DEFINITIONS) as SectionKey[]) {
    const def = SECTION_DEFINITIONS[key];
    // Si el contenido inicial no cumple su propio esquema es un error de código: mejor fallar aquí.
    const content = sectionSchemas[key].parse(def.contenidoInicial);
    const existente = await db.section.findUnique({ where: { key } });
    if (existente) {
      console.log(`  = ${key} ya existe; sin cambios.`);
      continue;
    }
    await db.section.create({
      data: {
        key,
        page: def.page,
        order: def.order,
        visible: true,
        content,
        publishedAt: new Date(),
      },
    });
    console.log(`  + ${key} creada (${def.nombre}).`);
  }

  console.log("\nSeed completo.");
} finally {
  await db.$disconnect();
}
