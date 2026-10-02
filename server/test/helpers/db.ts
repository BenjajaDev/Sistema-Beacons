import { hashPassword } from "../../src/auth/password.js";
import type { Role } from "../../src/generated/prisma/enums.js";
import { createPrisma, type Db } from "../../src/lib/prisma.js";
import { TEST_DATABASE_URL } from "./env.js";

export const hasTestDb = Boolean(TEST_DATABASE_URL);

export function testDb(): Db {
  return createPrisma(TEST_DATABASE_URL!);
}

// Vacía todas las tablas (la estructura la deja migrada test/global-setup.ts).
export async function resetDb(db: Db) {
  const tablas = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (!tablas.length) return;
  const lista = tablas.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
}

const hashes = new Map<string, Promise<string>>();

export async function createUser(
  db: Db,
  data: { email: string; password: string; role: Role; mustChangePassword?: boolean },
) {
  if (!hashes.has(data.password)) hashes.set(data.password, hashPassword(data.password));
  return db.user.create({
    data: {
      email: data.email,
      name: data.email.split("@")[0]!,
      role: data.role,
      passwordHash: await hashes.get(data.password)!,
      mustChangePassword: data.mustChangePassword ?? false,
    },
  });
}

// Configuración y secciones iniciales, como las deja `npm run seed`.
export async function seedContent(db: Db) {
  const { DEFAULT_SITE_SETTINGS } = await import("../../src/content/settings.js");
  const { SECTION_DEFINITIONS } = await import("../../src/content/sections.js");
  const { asJson } = await import("../../src/lib/json.js");
  await db.siteSettings.create({ data: DEFAULT_SITE_SETTINGS });
  for (const [key, def] of Object.entries(SECTION_DEFINITIONS)) {
    await db.section.create({
      data: { key, page: def.page, order: def.order, content: asJson(def.contenidoInicial) },
    });
  }
}
