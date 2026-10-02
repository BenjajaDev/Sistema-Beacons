import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma, type Db } from "../../src/lib/prisma.js";
import { createBackup, readBackup, restoreDatabase } from "../../src/services/backup.js";
import { writeBeaconSnapshot } from "../../src/beacons/snapshot.js";

// Pruebas contra un PostgreSQL real. Se ejecutan solo si TEST_DATABASE_URL está
// definida (por ejemplo, la base signal_test que crea `npm run db:local`).
// ATENCIÓN: borran por completo el schema public de esa base.

const url = process.env.TEST_DATABASE_URL;

// Resguardo: como la prueba borra el schema, solo corre contra bases cuyo nombre termina en _test.
if (url && !new URL(url).pathname.endsWith("_test")) {
  throw new Error("TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test.");
}
const SERVER_DIR = path.resolve(import.meta.dirname, "../..");

describe.skipIf(!url)("base de datos (integración)", () => {
  let db: Db;

  beforeAll(async () => {
    db = createPrisma(url!);
    await db.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await db.$executeRawUnsafe("CREATE SCHEMA public");
    execSync("npx prisma migrate deploy", {
      cwd: SERVER_DIR,
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
      stdio: "pipe",
    });
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("todas las tablas del schema public tienen RLS activado", async () => {
    const sinRls = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity`;
    expect(sinRls).toEqual([]);
  });

  it("no permite una imagen de noticia sin texto alternativo", async () => {
    const autor = await db.user.create({
      data: { email: "autor@test.cl", name: "Autor", role: "EDITOR", passwordHash: "x" },
    });
    const media = await db.media.create({
      data: {
        storageKey: "k1",
        url: "/u/k1.webp",
        mimeType: "image/webp",
        sizeBytes: 1,
        originalName: "a.webp",
      },
    });
    const base = {
      title: "T",
      excerpt: "E",
      bodyJson: { type: "doc", content: [] },
      bodyHtml: "",
      category: "General",
      authorId: autor.id,
      coverId: media.id,
    };
    await expect(
      db.news.create({ data: { ...base, slug: "sin-alt", coverAlt: "  " } }),
    ).rejects.toThrow();
    await expect(
      db.news.create({ data: { ...base, slug: "con-alt", coverAlt: "Persona usando la app" } }),
    ).resolves.toBeTruthy();
  });

  it("rechaza major/minor fuera del rango de iBeacon y duplicados", async () => {
    const ficha = { titulo: "T", descripcion: "D" };
    await expect(
      db.beacon.create({ data: { ...ficha, major: 70000, minor: 1 } }),
    ).rejects.toThrow();
    await db.beacon.create({ data: { ...ficha, major: 1, minor: 1 } });
    await expect(db.beacon.create({ data: { ...ficha, major: 1, minor: 1 } })).rejects.toThrow();
  });

  it("respalda y restaura la base completa", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "signal-backup-"));
    await db.beacon.create({
      data: { major: 2, minor: 7, titulo: "Antes", descripcion: "D", ubicacion: null },
    });
    await db.section.create({
      data: {
        key: "hero",
        page: "INICIO",
        order: 1,
        content: { titulo: "x" },
        draftContent: undefined,
      },
    });
    const archivo = await createBackup(db, dir, 3);

    await db.beacon.update({
      where: { major_minor: { major: 2, minor: 7 } },
      data: { titulo: "Después" },
    });
    await db.beacon.create({ data: { major: 9, minor: 9, titulo: "Nuevo", descripcion: "D" } });

    await restoreDatabase(db, await readBackup(archivo));

    const restaurado = await db.beacon.findUnique({
      where: { major_minor: { major: 2, minor: 7 } },
    });
    expect(restaurado?.titulo).toBe("Antes");
    expect(
      await db.beacon.findUnique({ where: { major_minor: { major: 9, minor: 9 } } }),
    ).toBeNull();
    expect((await db.section.findUnique({ where: { key: "hero" } }))?.draftContent).toBeNull();
    expect(await db.news.count()).toBe(1);

    const snapshot = path.join(dir, "beacons.snapshot.json");
    await writeBeaconSnapshot(db, snapshot);
    expect(JSON.parse(readFileSync(snapshot, "utf-8"))["2-7"]).toStrictEqual({
      titulo: "Antes",
      descripcion: "D",
    });
  });
});
