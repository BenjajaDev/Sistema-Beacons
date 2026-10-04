import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SECTION_DEFINITIONS } from "../../src/content/sections.js";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, seedContent, testDb } from "../helpers/db.js";
import { as, login, type TestSession } from "../helpers/session.js";

const CLAVE = "Clave-Segura-De-Prueba-1";

describe.skipIf(!hasTestDb)("secciones de la landing", () => {
  let db: Db;
  let app: ReturnType<typeof buildTestApp>;
  let admin: TestSession;
  let editor: TestSession;

  beforeAll(() => {
    db = testDb();
  });
  afterAll(() => db?.$disconnect());

  beforeEach(async () => {
    app = buildTestApp({ db, env: { LOGIN_RATE_LIMIT: "1000" } });
    await resetDb(db);
    await seedContent(db);
    await createUser(db, { email: "admin@signal.test", password: CLAVE, role: "ADMIN" });
    await createUser(db, { email: "editor@signal.test", password: CLAVE, role: "EDITOR" });
    admin = await login(app, "admin@signal.test", CLAVE);
    editor = await login(app, "editor@signal.test", CLAVE);
  });

  const heroNuevo = { ...SECTION_DEFINITIONS.hero.contenidoInicial, titulo: "Título nuevo" };
  const tituloPublico = async () => {
    const res = await request(app).get("/api/public/pages/inicio");
    return res.body.secciones.find((s: { key: string }) => s.key === "hero")?.content.titulo;
  };

  it("valida el contenido según la sección e indica el campo con error", async () => {
    const res = await as(app, editor, "put", "/api/admin/sections/hero/draft").send({
      content: { ...heroNuevo, accionPrincipal: { texto: "x", href: "javascript:alert(1)" } },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.campos)).toEqual(["accionPrincipal.href"]);
  });

  it("el borrador no se publica hasta que un admin lo aprueba", async () => {
    const guardado = await as(app, editor, "put", "/api/admin/sections/hero/draft").send({
      content: heroNuevo,
    });
    expect(guardado.body.section).toMatchObject({ draftStatus: "DRAFT", nombre: "Portada" });
    expect(await tituloPublico()).toBe(SECTION_DEFINITIONS.hero.contenidoInicial.titulo);

    await as(app, editor, "post", "/api/admin/sections/hero/submit");
    const bloqueado = await as(app, editor, "put", "/api/admin/sections/hero/draft").send({
      content: heroNuevo,
    });
    expect(bloqueado.status).toBe(403);
    expect(bloqueado.body.code).toBe("SECTION_LOCKED");
    expect((await as(app, editor, "post", "/api/admin/sections/hero/publish")).status).toBe(403);

    const publicado = await as(app, admin, "post", "/api/admin/sections/hero/publish");
    expect(publicado.body.section).toMatchObject({ draftStatus: null, draftContent: null });
    expect(await tituloPublico()).toBe("Título nuevo");
  });

  it("el admin puede devolver cambios con observaciones", async () => {
    await as(app, editor, "put", "/api/admin/sections/hero/draft").send({ content: heroNuevo });
    await as(app, editor, "post", "/api/admin/sections/hero/submit");
    const res = await as(app, admin, "post", "/api/admin/sections/hero/reject").send({
      note: "Más corto",
    });
    expect(res.body.section).toMatchObject({ draftStatus: "DRAFT", reviewNote: "Más corto" });
  });

  it("el texto enriquecido se regenera en el servidor y la landing recibe solo el HTML", async () => {
    await as(app, admin, "put", "/api/admin/sections/quienes-somos/draft").send({
      content: {
        titulo: "Quiénes somos",
        cuerpo: {
          json: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "<b>hola</b>" }] }],
          },
          html: "<script>alert(1)</script>",
        },
      },
    });
    await as(app, admin, "post", "/api/admin/sections/quienes-somos/publish");
    const res = await request(app).get("/api/public/pages/nosotros");
    const seccion = res.body.secciones.find((s: { key: string }) => s.key === "quienes-somos");
    expect(seccion.content.cuerpo).toEqual({ html: "<p>&lt;b&gt;hola&lt;/b&gt;</p>" });
  });

  it("ocultar una sección la quita de la landing", async () => {
    await as(app, admin, "patch", "/api/admin/sections/objetivos/visibility").send({
      visible: false,
    });
    const res = await request(app).get("/api/public/pages/inicio");
    expect(res.body.secciones.map((s: { key: string }) => s.key)).toEqual([
      "hero",
      "que-es",
      "proyecciones",
      "nosotros-inicio",
      "noticias-recientes",
    ]);
  });

  it("reordena las secciones de una página", async () => {
    const keys = [
      "proyecciones",
      "hero",
      "que-es",
      "nosotros-inicio",
      "objetivos",
      "noticias-recientes",
    ];
    expect(
      (await as(app, admin, "put", "/api/admin/sections/order").send({ page: "INICIO", keys }))
        .status,
    ).toBe(200);
    const res = await request(app).get("/api/public/pages/inicio");
    expect(res.body.secciones.map((s: { key: string }) => s.key)).toEqual(keys);

    const incompleto = await as(app, admin, "put", "/api/admin/sections/order").send({
      page: "INICIO",
      keys: ["hero"],
    });
    expect(incompleto.status).toBe(400);
  });

  it("una página o sección inexistente es 404", async () => {
    expect((await request(app).get("/api/public/pages/admin")).status).toBe(404);
    expect((await as(app, admin, "get", "/api/admin/sections/no-existe")).status).toBe(404);
  });
});
