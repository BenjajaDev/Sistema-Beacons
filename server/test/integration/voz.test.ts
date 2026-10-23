import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_VOICE } from "../../src/content/voice.js";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, seedContent, testDb } from "../helpers/db.js";
import { as, login, type TestSession } from "../helpers/session.js";

const CLAVE = "Clave-Segura-De-Prueba-1";

describe.skipIf(!hasTestDb)("configuración del audiodescriptor", () => {
  let db: Db;
  let app: ReturnType<typeof buildTestApp>;
  let editor: TestSession;

  beforeAll(() => {
    db = testDb();
  });
  afterAll(() => db?.$disconnect());

  beforeEach(async () => {
    app = buildTestApp({ db, env: { LOGIN_RATE_LIMIT: "1000" } });
    await resetDb(db);
    await seedContent(db);
    await createUser(db, { email: "editor@signal.test", password: CLAVE, role: "EDITOR" });
    editor = await login(app, "editor@signal.test", CLAVE);
  });

  const vozPublica = async () => (await request(app).get("/api/public/site")).body.voz;

  it("sin configurar, el sitio usa los valores por defecto", async () => {
    expect(await vozPublica()).toEqual(DEFAULT_VOICE);
  });

  it("se guarda (también como editor), llega al sitio y queda en la bitácora", async () => {
    const voz = { idioma: "es-ES", voz: "Lucía", velocidad: 1.2 };
    const res = await as(app, editor, "put", "/api/admin/settings/voice").send(voz);
    expect(res.status).toBe(200);
    expect(res.body.settings.voice).toEqual(voz);
    expect(await vozPublica()).toEqual(voz);
    const registro = await db.auditLog.findFirst({ where: { action: "SETTINGS_VOICE_UPDATE" } });
    expect(registro).not.toBeNull();
  });

  it("rechaza un idioma fuera de la lista y una velocidad fuera de rango", async () => {
    const res = await as(app, editor, "put", "/api/admin/settings/voice").send({
      idioma: "xx-XX",
      voz: "",
      velocidad: 3,
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.campos).sort()).toEqual(["idioma", "velocidad"]);
  });
});
