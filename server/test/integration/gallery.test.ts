import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, seedContent, testDb } from "../helpers/db.js";
import { as, login, type TestSession } from "../helpers/session.js";

const CLAVE = "Clave-Segura-De-Prueba-1";

describe.skipIf(!hasTestDb)("galería de fotos", () => {
  let db: Db;
  let app: ReturnType<typeof buildTestApp>;
  let admin: TestSession;
  let editor: TestSession;
  let social: TestSession;

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
    await createUser(db, { email: "social@signal.test", password: CLAVE, role: "SOCIAL" });
    admin = await login(app, "admin@signal.test", CLAVE);
    editor = await login(app, "editor@signal.test", CLAVE);
    social = await login(app, "social@signal.test", CLAVE);
  });

  const imagen = async (s: TestSession) => {
    const png = await sharp({
      create: { width: 60, height: 40, channels: 3, background: "#1A56DB" },
    })
      .png()
      .toBuffer();
    return (await as(app, s, "post", "/api/admin/media").attach("archivo", png, "foto.png")).body
      .media;
  };
  const crear = (s: TestSession, body: object) =>
    as(app, s, "post", "/api/admin/gallery").send(body);

  it("exige la foto y su texto alternativo", async () => {
    const m = await imagen(editor);
    const sinAlt = await crear(editor, { name: "Taller", mediaId: m.id, alt: "  " });
    expect(sinAlt.status).toBe(400);
    expect(sinAlt.body.campos.alt).toMatch(/Describe la foto/);
    const sinFoto = await crear(editor, { name: "Taller", alt: "Un taller" });
    expect(sinFoto.status).toBe(400);
    expect(sinFoto.body.campos.mediaId).toBeTruthy();
    const sinPie = await crear(editor, { mediaId: m.id, alt: "Un taller" });
    expect(sinPie.body.campos.name).toMatch(/pie de foto/);
    const inexistente = await crear(editor, {
      name: "x",
      mediaId: "7f3b8f0e-8c1a-4c11-9b53-6d6a3a2f1b11",
      alt: "Algo",
    });
    expect(inexistente.status).toBe(400);
    expect(inexistente.body.campos.mediaId).toMatch(/ya no existe/);
  });

  it("publica solo lo visible, en el orden del panel, con alt y sin ids", async () => {
    const a = await imagen(editor);
    const b = await imagen(editor);
    const c = await imagen(editor);
    await crear(editor, { name: "Primera", mediaId: a.id, alt: "Foto uno", credit: "Foto: Ana" });
    await crear(editor, { name: "Oculta", mediaId: b.id, alt: "Foto dos", visible: false });
    const ultima = await crear(editor, { name: "Tercera", mediaId: c.id, alt: "Foto tres" });
    expect(ultima.body.item.order).toBe(3);

    const res = await request(app).get("/api/public/gallery");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(["Primera", "Tercera"]);
    expect(res.body.items[0]).toMatchObject({
      credit: "Foto: Ana",
      image: { alt: "Foto uno", width: 60, height: 40 },
    });
    expect(res.body.items[0].id).toBeUndefined();
    expect(res.body.items[0].image.url).toMatch(/^\/uploads\//);
  });

  it("se reordena y el menú del sitio solo enlaza la galería si hay fotos visibles", async () => {
    expect((await request(app).get("/api/public/site")).body.modulos.galeria).toBe(false);
    const m = await imagen(editor);
    const x = (await crear(editor, { name: "X", mediaId: m.id, alt: "x" })).body.item.id;
    const y = (await crear(editor, { name: "Y", mediaId: m.id, alt: "y" })).body.item.id;
    expect((await request(app).get("/api/public/site")).body.modulos.galeria).toBe(true);
    const orden = await as(app, editor, "put", "/api/admin/gallery/order").send({ ids: [y, x] });
    expect(orden.status).toBe(200);
    const res = await request(app).get("/api/public/gallery");
    expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(["Y", "X"]);
  });

  it("quitar el texto alternativo al editar se rechaza", async () => {
    const m = await imagen(editor);
    const id = (await crear(editor, { name: "X", mediaId: m.id, alt: "Descripción" })).body.item.id;
    const res = await as(app, editor, "patch", `/api/admin/gallery/${id}`).send({ alt: "" });
    expect(res.status).toBe(400);
    expect(
      (await as(app, editor, "patch", `/api/admin/gallery/${id}`).send({ name: "Z" })).status,
    ).toBe(200);
  });

  it("no deja borrar una imagen que está en la galería", async () => {
    const m = await imagen(editor);
    const id = (await crear(editor, { name: "En uso", mediaId: m.id, alt: "Una foto" })).body.item
      .id;
    const borrar = await as(app, admin, "delete", `/api/admin/media/${m.id}`);
    expect(borrar.status).toBe(409);
    expect(borrar.body.usos).toEqual(["la foto «En uso» de la galería"]);
    await as(app, editor, "delete", `/api/admin/gallery/${id}`);
    expect((await as(app, admin, "delete", `/api/admin/media/${m.id}`)).status).toBe(204);
  });

  it("registra en la bitácora y respeta los roles", async () => {
    const m = await imagen(editor);
    expect((await crear(social, { name: "x", mediaId: m.id, alt: "x" })).status).toBe(403);
    const r = await crear(admin, { name: "Con bitácora", mediaId: m.id, alt: "Foto" });
    const acciones = (await db.auditLog.findMany({ where: { entityId: r.body.item.id } })).map(
      (a) => a.action,
    );
    expect(acciones).toEqual(["GALLERY_ITEM_CREATE"]);
  });

  it("el HTML de /galeria trae sus datos iniciales y entra al sitemap", async () => {
    const html = await request(app).get("/galeria");
    expect(html.status).toBe(200);
    expect(html.text).toContain("<title>Galería · ");
    expect(html.text).toContain('id="datos-iniciales"');
    expect((await request(app).get("/sitemap.xml")).text).toContain("/galeria</loc>");
  });
});
