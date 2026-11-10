import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TIPOS_RECURSO } from "../../src/content/resource-kinds.js";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, seedContent, testDb } from "../helpers/db.js";
import { testEnv } from "../helpers/env.js";
import { as, login, type TestSession } from "../helpers/session.js";

const CLAVE = "Clave-Segura-De-Prueba-1";
const env = testEnv();

// Un PDF mínimo: lo único que se verifica es la firma «%PDF-».
const pdf = (relleno = 0) =>
  Buffer.concat([Buffer.from("%PDF-1.4\n% prueba\n%%EOF\n"), Buffer.alloc(relleno, 32)]);

describe.skipIf(!hasTestDb)("repositorio de recursos", () => {
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

  const subirPdf = (s: TestSession, data = pdf(), nombre = "informe.pdf") =>
    as(app, s, "post", "/api/admin/documents").attach("archivo", data, nombre);
  const crear = (s: TestSession, body: object) =>
    as(app, s, "post", "/api/admin/resources").send(body);

  it("sube un PDF y lo guarda sin pasarlo por el procesador de imágenes", async () => {
    const res = await subirPdf(editor);
    expect(res.status).toBe(201);
    expect(res.body.media).toMatchObject({ originalName: "informe.pdf" });
    expect(res.body.media.url).toMatch(/^\/uploads\/documentos\/[\w-]+\.pdf$/);
    const fila = await db.media.findUniqueOrThrow({ where: { id: res.body.media.id } });
    expect(fila.mimeType).toBe("application/pdf");
    expect(existsSync(path.join(env.uploadDir, fila.storageKey))).toBe(true);
    const descarga = await request(app).get(res.body.media.url);
    expect(descarga.status).toBe(200);
    expect(descarga.headers["content-type"]).toContain("application/pdf");
  });

  it("rechaza lo que no es un PDF aunque se llame .pdf", async () => {
    const falso = await subirPdf(editor, Buffer.from("<script>alert(1)</script>"), "informe.pdf");
    expect(falso.status).toBe(400);
    expect(falso.body.campos.archivo).toMatch(/PDF/);
    const imagen = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    expect((await subirPdf(editor, imagen, "foto.pdf")).status).toBe(400);
    expect((await as(app, editor, "post", "/api/admin/documents")).status).toBe(400);
  });

  it("los PDF no aparecen en la biblioteca de imágenes", async () => {
    await subirPdf(editor);
    const biblioteca = await as(app, editor, "get", "/api/admin/media");
    expect(biblioteca.body.items).toHaveLength(0);
  });

  it("exige archivo, DOI o enlace, y valida cada uno", async () => {
    const vacio = await crear(editor, { title: "Sin acceso" });
    expect(vacio.status).toBe(400);
    expect(vacio.body.campos.fileId).toMatch(/PDF|DOI/);

    const doiMalo = await crear(editor, { title: "x", doi: "abc" });
    expect(doiMalo.body.campos.doi).toMatch(/DOI válido/);
    const http = await crear(editor, { title: "x", externalUrl: "http://inseguro.cl/a" });
    expect(http.body.campos.externalUrl).toMatch(/https/);
    const fecha = await crear(editor, { title: "x", doi: "10.1234/ab", publishedOn: "ayer" });
    expect(fecha.body.campos.publishedOn).toMatch(/fecha/);
    const tipo = await crear(editor, { title: "x", doi: "10.1234/ab", kind: "VIDEO" });
    expect(tipo.body.campos.kind).toBeTruthy();
    const inexistente = await crear(editor, {
      title: "x",
      fileId: "7f3b8f0e-8c1a-4c11-9b53-6d6a3a2f1b11",
    });
    expect(inexistente.body.campos.fileId).toMatch(/ya no existe/);
  });

  it("no acepta como archivo una imagen de la biblioteca", async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } })
      .png()
      .toBuffer();
    const img = await as(app, editor, "post", "/api/admin/media").attach("archivo", png, "a.png");
    const res = await crear(editor, { title: "x", fileId: img.body.media.id });
    expect(res.status).toBe(400);
  });

  it("guarda el DOI limpio aunque llegue como enlace de doi.org", async () => {
    const res = await crear(editor, {
      title: "Artículo",
      kind: "ARTICLE",
      doi: "https://doi.org/10.1234/abcd.5678",
      publishedOn: "2026-03-15",
    });
    expect(res.status).toBe(201);
    expect(res.body.item.doi).toBe("10.1234/abcd.5678");
    expect(res.body.item.publishedOn).toBe("2026-03-15T00:00:00.000Z");
  });

  it("publica solo lo visible, con filtro por tipo y búsqueda, y sin ids", async () => {
    const archivo = (await subirPdf(editor, pdf(2048))).body.media.id;
    await crear(editor, {
      title: "Informe de impacto 2026",
      kind: "REPORT",
      authors: "Equipo SIGNAL",
      fileId: archivo,
      license: "CC BY 4.0",
      publishedOn: "2026-06-01",
    });
    await crear(editor, { title: "Guía de instalación", kind: "GUIDE", doi: "10.5555/guia" });
    await crear(editor, {
      title: "Borrador interno",
      externalUrl: "https://repositorio.example.cl/x",
      visible: false,
    });

    const todo = await request(app).get("/api/public/resources");
    expect(todo.status).toBe(200);
    expect(todo.headers["cache-control"]).toBe("no-cache");
    expect(todo.body.total).toBe(2);
    // Lo más reciente primero; lo que no trae fecha, al final.
    expect(todo.body.items.map((r: { title: string }) => r.title)).toEqual([
      "Informe de impacto 2026",
      "Guía de instalación",
    ]);
    const informe = todo.body.items[0];
    expect(informe).toMatchObject({
      kind: "REPORT",
      publishedOn: "2026-06-01",
      license: "CC BY 4.0",
      doiUrl: null,
    });
    expect(informe.file.url).toMatch(/^\/uploads\/documentos\//);
    expect(informe.file.sizeBytes).toBeGreaterThan(2048);
    expect(informe.id).toBeUndefined();
    expect(todo.body.items[1].doiUrl).toBe("https://doi.org/10.5555/guia");

    const guias = await request(app).get("/api/public/resources?tipo=GUIDE");
    expect(guias.body.items.map((r: { title: string }) => r.title)).toEqual([
      "Guía de instalación",
    ]);
    const busqueda = await request(app).get("/api/public/resources?q=signal");
    expect(busqueda.body.total).toBe(1);
    expect((await request(app).get("/api/public/resources?tipo=VIDEO")).status).toBe(400);
  });

  it("el encabezado del sitio solo enlaza Recursos cuando hay alguno visible", async () => {
    expect((await request(app).get("/api/public/site")).body.modulos).toEqual({
      recursos: false,
      galeria: false,
    });
    await crear(editor, { title: "Oculto", doi: "10.1234/o", visible: false });
    expect((await request(app).get("/api/public/site")).body.modulos.recursos).toBe(false);
    await crear(editor, { title: "Visible", doi: "10.1234/v" });
    expect((await request(app).get("/api/public/site")).body.modulos.recursos).toBe(true);
  });

  it("al reemplazar o borrar un recurso se borra su PDF, pero no si lo usa otro", async () => {
    const a = (await subirPdf(editor)).body.media;
    const b = (await subirPdf(editor, pdf(10), "nuevo.pdf")).body.media;
    const r = await crear(editor, { title: "Con PDF", fileId: a.id });
    const id = r.body.item.id;

    const cambio = await as(app, editor, "patch", `/api/admin/resources/${id}`).send({
      fileId: b.id,
    });
    expect(cambio.status).toBe(200);
    expect(await db.media.findUnique({ where: { id: a.id } })).toBeNull();

    // Quitar el único acceso no se permite.
    const sinAcceso = await as(app, editor, "patch", `/api/admin/resources/${id}`).send({
      fileId: null,
    });
    expect(sinAcceso.status).toBe(400);
    // Con un DOI de respaldo sí se puede quitar el PDF.
    await as(app, editor, "patch", `/api/admin/resources/${id}`).send({
      fileId: null,
      doi: "10.1234/ok",
    });
    expect(await db.media.findUnique({ where: { id: b.id } })).toBeNull();

    const otro = (await subirPdf(editor)).body.media;
    const r2 = await crear(editor, { title: "Uno", fileId: otro.id });
    expect(
      (await as(app, editor, "delete", `/api/admin/resources/${r2.body.item.id}`)).status,
    ).toBe(204);
    expect(await db.media.findUnique({ where: { id: otro.id } })).toBeNull();
  });

  it("registra en la bitácora y respeta los roles", async () => {
    expect((await subirPdf(social)).status).toBe(403);
    expect((await crear(social, { title: "x", doi: "10.1234/x" })).status).toBe(403);
    const r = await crear(admin, { title: "Con bitácora", doi: "10.1234/b" });
    await as(app, admin, "patch", `/api/admin/resources/${r.body.item.id}`).send({
      title: "Con bitácora 2",
    });
    const acciones = (
      await db.auditLog.findMany({
        where: { entityId: r.body.item.id },
        orderBy: { createdAt: "asc" },
      })
    ).map((a) => a.action);
    expect(acciones).toEqual(["RESOURCE_CREATE", "RESOURCE_UPDATE"]);
  });

  it("el HTML de /recursos trae sus datos iniciales y entra al sitemap", async () => {
    await crear(editor, { title: "Visible", doi: "10.1234/v" });
    const html = await request(app).get("/recursos?tipo=REPORT");
    expect(html.status).toBe(200);
    expect(html.text).toContain("<title>Recursos · ");
    expect(html.text).toContain('id="datos-iniciales"');
    const sitemap = await request(app).get("/sitemap.xml");
    expect(sitemap.text).toContain("/recursos</loc>");
  });

  it("las claves de los tipos coinciden con el enum de la base", async () => {
    const filas = await db.$queryRaw<{ e: string }[]>`
      SELECT unnest(enum_range(NULL::"ResourceKind"))::text AS e`;
    expect(filas.map((f) => f.e).sort()).toEqual(TIPOS_RECURSO.map((t) => t.clave).sort());
  });

  it("el kit de prensa nace oculto; al mostrarlo, /noticias trae sus archivos en el HTML", async () => {
    const kit = await db.section.findUniqueOrThrow({ where: { key: "kit-prensa" } });
    expect(kit).toMatchObject({ visible: false, page: "NOTICIAS" });
    await crear(editor, { title: "Dossier de prensa", kind: "PRESS_KIT", doi: "10.1234/kit" });
    await crear(editor, { title: "Informe", kind: "REPORT", doi: "10.1234/inf" });

    const oculto = await request(app).get("/noticias");
    expect(oculto.text).not.toContain("Dossier de prensa");

    await db.section.update({ where: { key: "kit-prensa" }, data: { visible: true } });
    const visible = await request(app).get("/noticias");
    expect(visible.text).toContain("Dossier de prensa");
    expect(visible.text).toContain('"kit-prensa"');
    // Solo los archivos del tipo «Kit de prensa».
    expect(visible.text).not.toContain("10.1234/inf");
  });
});
