import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SECTION_DEFINITIONS } from "../../src/content/sections.js";
import { asJson } from "../../src/lib/json.js";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, seedContent, testDb } from "../helpers/db.js";
import { as, login, type TestSession } from "../helpers/session.js";

const CLAVE = "Clave-Segura-De-Prueba-1";
const INICIAL = SECTION_DEFINITIONS.hero.contenidoInicial.audiodescripcion;

describe.skipIf(!hasTestDb)("audiodescripción de las secciones principales", () => {
  let db: Db;
  let app: ReturnType<typeof buildTestApp>;
  let admin: TestSession;

  beforeAll(() => {
    db = testDb();
  });
  afterAll(() => db?.$disconnect());

  beforeEach(async () => {
    app = buildTestApp({ db, env: { LOGIN_RATE_LIMIT: "1000" } });
    await resetDb(db);
    await seedContent(db);
    await createUser(db, { email: "admin@signal.test", password: CLAVE, role: "ADMIN" });
    admin = await login(app, "admin@signal.test", CLAVE);
  });

  const heroPublico = async () => {
    const res = await request(app).get("/api/public/pages/inicio");
    return res.body.secciones.find((s: { key: string }) => s.key === "hero")?.content;
  };

  async function publicarHero(cambios: object) {
    const { body } = await as(app, admin, "get", "/api/admin/sections/hero");
    const guardado = await as(app, admin, "put", "/api/admin/sections/hero/draft").send({
      content: { ...body.section.content, ...cambios },
    });
    expect(guardado.status).toBe(200);
    expect((await as(app, admin, "post", "/api/admin/sections/hero/publish")).status).toBe(200);
  }

  it("una base anterior al campo recibe el texto inicial, en la landing y en el panel", async () => {
    // Como en producción: la sección existe sin el campo.
    const hero = await db.section.findUniqueOrThrow({ where: { key: "hero" } });
    const sinCampo = { ...(hero.content as Record<string, unknown>) };
    delete sinCampo.audiodescripcion;
    await db.section.update({ where: { key: "hero" }, data: { content: asJson(sinCampo) } });

    expect(INICIAL).toBeTruthy();
    expect((await heroPublico()).audiodescripcion).toBe(INICIAL);
    const panel = await as(app, admin, "get", "/api/admin/sections/hero");
    expect(panel.body.section.content.audiodescripcion).toBe(INICIAL);
  });

  it("se edita, y vacía a propósito no vuelve el texto inicial", async () => {
    await publicarHero({ audiodescripcion: "Portada con un beacon y sus ondas." });
    expect((await heroPublico()).audiodescripcion).toBe("Portada con un beacon y sus ondas.");

    await publicarHero({ audiodescripcion: "" });
    expect((await heroPublico()).audiodescripcion).toBe("");
  });

  it("rechaza una audiodescripción demasiado larga", async () => {
    const { body } = await as(app, admin, "get", "/api/admin/sections/hero");
    const res = await as(app, admin, "put", "/api/admin/sections/hero/draft").send({
      content: { ...body.section.content, audiodescripcion: "a".repeat(1201) },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.campos)).toEqual(["audiodescripcion"]);
  });
});
