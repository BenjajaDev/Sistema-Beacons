import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db.js";
import { as, login, type TestSession } from "../helpers/session.js";

const CLAVE = "Clave-Segura-De-Prueba-1";

const cuerpo = (texto = "Contenido de la nota con información útil.") => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: texto }] }],
});

const notaCompleta = {
  title: "Inauguración de la sede",
  excerpt: "SIGNAL llega a un nuevo edificio.",
  category: "Proyecto",
  bodyJson: cuerpo(),
};

describe.skipIf(!hasTestDb)("noticias: flujo editorial", () => {
  let db: Db;
  let app: ReturnType<typeof buildTestApp>;
  let admin: TestSession;
  let editor: TestSession;
  let otroEditor: TestSession;

  beforeAll(() => {
    db = testDb();
  });
  afterAll(() => db?.$disconnect());

  beforeEach(async () => {
    app = buildTestApp({ db, env: { LOGIN_RATE_LIMIT: "1000" } });
    await resetDb(db);
    await createUser(db, { email: "admin@signal.test", password: CLAVE, role: "ADMIN" });
    await createUser(db, { email: "editor@signal.test", password: CLAVE, role: "EDITOR" });
    await createUser(db, { email: "otro@signal.test", password: CLAVE, role: "EDITOR" });
    admin = await login(app, "admin@signal.test", CLAVE);
    editor = await login(app, "editor@signal.test", CLAVE);
    otroEditor = await login(app, "otro@signal.test", CLAVE);
  });

  const crear = (s: TestSession, body: object = notaCompleta) =>
    as(app, s, "post", "/api/admin/news").send(body);

  it("genera el slug desde el título y evita duplicados", async () => {
    const a = await crear(editor, { title: "¿Qué es SIGNAL? Ñandú" });
    const b = await crear(editor, { title: "¿Qué es SIGNAL? Ñandú" });
    expect(a.status).toBe(201);
    expect(a.body.news.slug).toBe("que-es-signal-nandu");
    expect(b.body.news.slug).toBe("que-es-signal-nandu-2");
    expect(a.body.news.status).toBe("DRAFT");
  });

  it("guarda borradores incompletos para no perder lo escrito", async () => {
    const res = await crear(editor, { title: "Solo el título" });
    expect(res.status).toBe(201);
    expect(res.body.news.excerpt).toBe("");
  });

  it("genera el HTML en el servidor e ignora el que mande el navegador", async () => {
    const res = await crear(editor, { ...notaCompleta, bodyHtml: "<script>alert(1)</script>" });
    const n = await db.news.findUniqueOrThrow({ where: { id: res.body.news.id } });
    expect(n.bodyHtml).toBe("<p>Contenido de la nota con información útil.</p>");
  });

  it("no permite una portada sin texto alternativo", async () => {
    const media = await db.media.create({
      data: {
        storageKey: "k",
        url: "/uploads/k.webp",
        mimeType: "image/webp",
        sizeBytes: 1,
        originalName: "k.webp",
      },
    });
    const res = await crear(editor, { ...notaCompleta, coverId: media.id, coverAlt: "  " });
    expect(res.status).toBe(400);
    expect(res.body.campos.coverAlt).toMatch(/Describe la imagen/);
  });

  it("no envía a revisión una nota incompleta o con problemas de accesibilidad", async () => {
    const { body } = await crear(editor, {
      title: "Incompleta",
      bodyJson: {
        type: "doc",
        content: [{ type: "image", attrs: { src: "/uploads/a.webp", alt: "" } }],
      },
    });
    const res = await as(app, editor, "post", `/api/admin/news/${body.news.id}/submit`);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("NOT_READY");
    expect(Object.keys(res.body.campos)).toEqual(["excerpt", "category"]);
    expect(res.body.accesibilidad.errores.map((e: { code: string }) => e.code)).toEqual([
      "IMAGEN_SIN_ALT",
      "CUERPO_VACIO",
    ]);
  });

  it("recorre borrador → revisión → devuelta → revisión → publicada → pública", async () => {
    const { body } = await crear(editor);
    const id = body.news.id;
    const slug = body.news.slug;

    // Mientras es borrador, el público no la ve.
    expect((await request(app).get(`/api/public/news/${slug}`)).status).toBe(404);

    expect((await as(app, editor, "post", `/api/admin/news/${id}/submit`)).body.news.status).toBe(
      "REVIEW",
    );

    // En revisión, el editor ya no puede editarla ni publicarla.
    const editar = await as(app, editor, "patch", `/api/admin/news/${id}`).send({ title: "Otro" });
    expect(editar.status).toBe(403);
    expect(editar.body.code).toBe("NEWS_LOCKED");
    expect((await as(app, editor, "post", `/api/admin/news/${id}/publish`)).status).toBe(403);

    // El admin la devuelve con observaciones.
    const devuelta = await as(app, admin, "post", `/api/admin/news/${id}/reject`).send({
      note: "Agrega la fecha del evento.",
    });
    expect(devuelta.body.news).toMatchObject({
      status: "DRAFT",
      reviewNote: "Agrega la fecha del evento.",
    });

    await as(app, editor, "patch", `/api/admin/news/${id}`).send({
      excerpt: "El 3 de octubre, SIGNAL llega.",
    });
    await as(app, editor, "post", `/api/admin/news/${id}/submit`);

    const publicada = await as(app, admin, "post", `/api/admin/news/${id}/publish`);
    expect(publicada.body.news.status).toBe("PUBLISHED");
    expect(publicada.body.news.reviewer.name).toBe("admin");

    const lista = await request(app).get("/api/public/news");
    expect(lista.body.total).toBe(1);
    expect(lista.body.items[0]).toMatchObject({ slug, excerpt: "El 3 de octubre, SIGNAL llega." });
    expect(lista.body.items[0].id).toBeUndefined();

    const detalle = await request(app).get(`/api/public/news/${slug}`);
    expect(detalle.status).toBe(200);
    expect(detalle.body.news.bodyHtml).toContain("<p>");
    expect(detalle.headers["cache-control"]).toContain("max-age=60");

    const acciones = (
      await db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } })
    ).map((a) => a.action);
    expect(acciones).toEqual([
      "NEWS_CREATE",
      "NEWS_SUBMIT",
      "NEWS_REJECT",
      "NEWS_UPDATE",
      "NEWS_SUBMIT",
      "NEWS_PUBLISH",
    ]);
  });

  it("un editor no puede editar ni borrar la nota de otra persona", async () => {
    const { body } = await crear(editor);
    const id = body.news.id;
    expect(
      (await as(app, otroEditor, "patch", `/api/admin/news/${id}`).send({ title: "x" })).status,
    ).toBe(403);
    expect((await as(app, otroEditor, "delete", `/api/admin/news/${id}`)).status).toBe(403);
    expect((await as(app, editor, "delete", `/api/admin/news/${id}`)).status).toBe(204);
  });

  it("después de publicar, el slug queda fijo y el editor no puede borrarla", async () => {
    const { body } = await crear(editor);
    const id = body.news.id;
    await as(app, admin, "post", `/api/admin/news/${id}/publish`);
    await as(app, admin, "post", `/api/admin/news/${id}/unpublish`);

    const slug = await as(app, admin, "patch", `/api/admin/news/${id}`).send({ slug: "otro-slug" });
    expect(slug.status).toBe(400);
    expect(slug.body.campos.slug).toMatch(/no se puede cambiar/);

    await db.news.update({
      where: { id },
      data: {
        authorId: (await db.user.findUniqueOrThrow({ where: { email: "editor@signal.test" } })).id,
      },
    });
    expect((await as(app, editor, "delete", `/api/admin/news/${id}`)).status).toBe(403);
  });

  it("la vista previa entrega el borrador con la misma forma que la landing", async () => {
    const { body } = await crear(editor);
    const res = await as(app, editor, "get", `/api/admin/news/${body.news.id}/preview`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DRAFT");
    expect(Object.keys(res.body.news).sort()).toEqual([
      "author",
      "bodyHtml",
      "category",
      "cover",
      "excerpt",
      "lectura",
      "publishedAt",
      "slug",
      "title",
      "updatedAt",
    ]);
  });

  it("lista con filtros y conteo por estado", async () => {
    await crear(editor);
    await crear(otroEditor);
    const mias = await as(app, editor, "get", "/api/admin/news?mias=true");
    expect(mias.body.items).toHaveLength(1);
    expect(mias.body.items[0].bodyJson).toBeUndefined();
    expect(mias.body.porEstado).toEqual({ DRAFT: 2 });
    const cats = await as(app, editor, "get", "/api/admin/news/categories");
    expect(cats.body.categorias).toEqual(["Proyecto"]);
  });
});
