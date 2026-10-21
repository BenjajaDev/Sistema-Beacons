import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PALETTE } from "../../src/content/theme.js";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, seedContent, testDb } from "../helpers/db.js";
import { testEnv } from "../helpers/env.js";
import { as, cookieHeader, login, type TestSession } from "../helpers/session.js";

const CLAVE = "Clave-Segura-De-Prueba-1";
const env = testEnv();

const png = () =>
  sharp({ create: { width: 40, height: 30, channels: 3, background: "#1A56DB" } })
    .png()
    .toBuffer();

describe.skipIf(!hasTestDb)("administración de contenido", () => {
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

  const subir = (s: TestSession, data: Buffer, nombre = "foto.png") =>
    as(app, s, "post", "/api/admin/media").attach("archivo", data, nombre);

  describe("imágenes", () => {
    it("valida por contenido, recodifica y sirve el archivo", async () => {
      const res = await subir(editor, await png());
      expect(res.status).toBe(201);
      expect(res.body.media).toMatchObject({ mimeType: "image/png", width: 40, height: 30 });
      expect(res.body.media.url).toMatch(/^\/uploads\/\d{4}\/\d{2}\/[\w-]+\.png$/);
      expect(existsSync(path.join(env.uploadDir, res.body.media.storageKey))).toBe(true);

      const archivo = await request(app).get(res.body.media.url);
      expect(archivo.status).toBe(200);
      expect(archivo.headers["content-type"]).toBe("image/png");
      expect(archivo.headers["cache-control"]).toContain("immutable");
    });

    it("convierte JPG a WebP y elimina los metadatos EXIF (ubicación GPS)", async () => {
      const jpg = await sharp({
        create: { width: 20, height: 20, channels: 3, background: "#f00" },
      })
        .jpeg()
        .withExif({ IFD0: { Copyright: "secreto" } })
        .toBuffer();
      expect((await sharp(jpg).metadata()).exif).toBeDefined();
      const res = await subir(editor, jpg, "foto.jpg");
      expect(res.body.media.mimeType).toBe("image/webp");
      const guardado = readFileSync(path.join(env.uploadDir, res.body.media.storageKey));
      expect((await sharp(guardado).metadata()).exif).toBeUndefined();
    });

    it("rechaza un archivo que no es imagen aunque se llame .png", async () => {
      const res = await subir(editor, Buffer.from("<script>alert(1)</script>"), "falso.png");
      expect(res.status).toBe(415);
      expect(res.body.error).toMatch(/JPG, PNG, WebP o AVIF/);
    });

    it("rechaza archivos más grandes que el máximo", async () => {
      const chica = buildTestApp({ db, env: { UPLOAD_MAX_MB: "0.1" } });
      const res = await request(chica)
        .post("/api/admin/media")
        .set("Cookie", admin.cookie)
        .set("X-CSRF-Token", admin.csrfToken)
        .attach("archivo", Buffer.alloc(200 * 1024, 1), "grande.png");
      expect(res.status).toBe(413);
      expect(res.body.code).toBe("FILE_TOO_LARGE");
    });

    it("recorta una imagen como una nueva, sin tocar la original", async () => {
      const subida = await as(app, editor, "post", "/api/admin/media").attach(
        "archivo",
        await png(),
        "foto.png",
      );
      const original = subida.body.media;
      const recorte = await as(app, editor, "post", `/api/admin/media/${original.id}/crop`).send({
        x: 5,
        y: 0,
        width: 30,
        height: 30,
      });
      expect(recorte.status).toBe(201);
      expect(recorte.body.media).toMatchObject({
        width: 30,
        height: 30,
        mimeType: "image/png",
        originalName: "foto.png (recorte)",
      });
      expect(recorte.body.media.id).not.toBe(original.id);
      const archivo = path.join(env.uploadDir, recorte.body.media.storageKey);
      expect((await sharp(readFileSync(archivo)).metadata()).width).toBe(30);

      const fuera = await as(app, editor, "post", `/api/admin/media/${original.id}/crop`).send({
        x: 20,
        y: 0,
        width: 30,
        height: 30,
      });
      expect(fuera.status).toBe(400);
    });

    it("no deja borrar una imagen en uso", async () => {
      const { body } = await subir(admin, await png());
      await as(app, admin, "post", "/api/admin/team").send({
        name: "Ana",
        position: "Coordinación",
        photoId: body.media.id,
        photoAlt: "Ana sonriendo",
      });
      const res = await as(app, admin, "delete", `/api/admin/media/${body.media.id}`);
      expect(res.status).toBe(409);
      expect(res.body.usos).toEqual(["la foto de Ana"]);
    });
  });

  describe("identidad visual", () => {
    const identidad = {
      siteName: "SIGNAL",
      palette: DEFAULT_PALETTE,
      fonts: { cuerpo: "atkinson-hyperlegible-next", titulos: "bricolage-grotesque" },
    };

    it("rechaza colores sin contraste suficiente y explica cuáles", async () => {
      const res = await as(app, admin, "put", "/api/admin/settings/identity").send({
        ...identidad,
        palette: { ...DEFAULT_PALETTE, light: { ...DEFAULT_PALETTE.light, texto: "#5B8EFF" } },
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("CONTRAST");
      expect(res.body.fallas[0]).toMatchObject({ modo: "light", frente: "texto", minimo: 4.5 });
    });

    it("exige texto alternativo para el logo", async () => {
      const { body } = await subir(admin, await png());
      const res = await as(app, admin, "put", "/api/admin/settings/identity").send({
        ...identidad,
        logoLightId: body.media.id,
      });
      expect(res.status).toBe(400);
      expect(res.body.campos.logoLightAlt).toBeDefined();
    });

    it("los cambios publicados se reflejan en la API pública sin redeploy", async () => {
      const { body } = await subir(admin, await png());
      const nueva = {
        ...DEFAULT_PALETTE,
        light: { ...DEFAULT_PALETTE.light, primario: "#0B4BC4" },
      };
      const res = await as(app, admin, "put", "/api/admin/settings/identity").send({
        ...identidad,
        siteName: "SIGNAL Chile",
        palette: nueva,
        logoLightId: body.media.id,
        logoLightAlt: "Logo de SIGNAL",
      });
      expect(res.status).toBe(200);
      const site = await request(app).get("/api/public/site");
      expect(site.body).toMatchObject({
        siteName: "SIGNAL Chile",
        palette: nueva,
        logos: { claro: { url: body.media.url, alt: "Logo de SIGNAL" } },
        fonts: { cuerpo: { nombre: "Atkinson Hyperlegible Next" } },
      });
    });

    it("el panel recibe el tema guardado inyectado en su HTML", async () => {
      const nueva = {
        ...DEFAULT_PALETTE,
        light: { ...DEFAULT_PALETTE.light, primario: "#0B4BC4" },
      };
      await as(app, admin, "put", "/api/admin/settings/identity").send({
        ...identidad,
        palette: nueva,
      });
      const html = await request(app).get(`/${env.ADMIN_PATH}`);
      expect(html.text).toMatch(/<style id="tema">[^<]*--color-primary:#0B4BC4/);
    });

    it("guarda el contacto y valida correo y redes", async () => {
      const mala = await as(app, admin, "put", "/api/admin/settings/contact").send({
        contactEmail: "no-es-correo",
        socials: [{ red: "Instagram", url: "http://instagram.com/x" }],
        accessibilityStatement: "x",
      });
      expect(mala.status).toBe(400);
      expect(Object.keys(mala.body.campos).sort()).toEqual(["contactEmail", "socials.0.url"]);

      const ok = await as(app, admin, "put", "/api/admin/settings/contact").send({
        contactEmail: "hola@signal.cl",
        contactPhone: "+56 9 1234 5678",
        socials: [{ red: "Instagram", url: "https://instagram.com/signal" }],
        accessibilityStatement: "Declaración.",
      });
      expect(ok.status).toBe(200);
      expect((await request(app).get("/api/public/site")).body.contacto.correo).toBe(
        "hola@signal.cl",
      );
    });

    it("guarda el pie de página, valida sus enlaces y lo publica", async () => {
      const inicial = (await request(app).get("/api/public/site")).body.pie;
      expect(inicial.mostrarContacto).toBe(true);
      expect(inicial.columnas[0].enlaces.length).toBeGreaterThan(0);

      const pie = {
        descripcion: "Orientación con voz.",
        columnas: [{ titulo: "Proyecto", enlaces: [{ texto: "Equipo", href: "/nosotros" }] }],
        mostrarContacto: false,
        mostrarRedes: true,
        mostrarAccesibilidad: true,
        textoLegal: "Proyecto académico.",
      };
      const mala = await as(app, admin, "put", "/api/admin/settings/footer").send({
        ...pie,
        columnas: [{ titulo: "Proyecto", enlaces: [{ texto: "Equipo", href: "javascript:x" }] }],
      });
      expect(mala.status).toBe(400);
      expect(Object.keys(mala.body.campos)).toEqual(["columnas.0.enlaces.0.href"]);

      expect((await as(app, editor, "put", "/api/admin/settings/footer").send(pie)).status).toBe(
        403,
      );
      expect((await as(app, admin, "put", "/api/admin/settings/footer").send(pie)).status).toBe(
        200,
      );
      expect((await request(app).get("/api/public/site")).body.pie).toEqual(pie);
    });
  });

  describe("equipo y colaboradores", () => {
    it("crea, edita sin perder campos omitidos, oculta y reordena", async () => {
      const a = await as(app, admin, "post", "/api/admin/team").send({
        name: "Ana",
        position: "Coordinación",
      });
      const b = await as(app, admin, "post", "/api/admin/team").send({
        name: "Beto",
        position: "Desarrollo",
      });
      expect(a.status).toBe(201);
      expect([a.body.item.order, b.body.item.order]).toEqual([1, 2]);

      await as(app, admin, "patch", `/api/admin/team/${a.body.item.id}`).send({ visible: false });
      // Un PATCH sin `visible` no debe volver a mostrarla (en Zod 4, .partial() aplica defaults).
      const edit = await as(app, admin, "patch", `/api/admin/team/${a.body.item.id}`).send({
        bio: "Bio",
      });
      expect(edit.body.item).toMatchObject({ visible: false, bio: "Bio", name: "Ana" });

      expect(
        (await request(app).get("/api/public/team")).body.items.map(
          (m: { name: string }) => m.name,
        ),
      ).toEqual(["Beto"]);

      await as(app, admin, "patch", `/api/admin/team/${a.body.item.id}`).send({ visible: true });
      await as(app, admin, "put", "/api/admin/team/order").send({
        ids: [b.body.item.id, a.body.item.id],
      });
      expect(
        (await request(app).get("/api/public/team")).body.items.map(
          (m: { name: string }) => m.name,
        ),
      ).toEqual(["Beto", "Ana"]);
    });

    it("valida el enlace del colaborador", async () => {
      const res = await as(app, admin, "post", "/api/admin/collaborators").send({
        name: "U",
        url: "javascript:alert(1)",
      });
      expect(res.status).toBe(400);
      expect(res.body.campos.url).toMatch(/https:\/\//);
    });
  });

  describe("usuarios", () => {
    it("crea una cuenta con contraseña temporal que obliga a cambiarla", async () => {
      const res = await as(app, admin, "post", "/api/admin/users").send({
        email: "Nueva@Signal.test",
        name: "Nueva",
        role: "EDITOR",
      });
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe("nueva@signal.test");
      expect(res.body.user.passwordHash).toBeUndefined();
      const s = await login(app, "nueva@signal.test", res.body.temporaryPassword);
      expect((await as(app, s, "get", "/api/admin/news")).body.code).toBe(
        "PASSWORD_CHANGE_REQUIRED",
      );

      const dup = await as(app, admin, "post", "/api/admin/users").send({
        email: "nueva@signal.test",
        name: "x",
        role: "EDITOR",
      });
      expect(dup.status).toBe(409);
      expect(dup.body.campos.email).toBeDefined();
    });

    it("elimina cuentas sin contenido y pide desactivar las que tienen autoría", async () => {
      const yo = await db.user.findUniqueOrThrow({ where: { email: "admin@signal.test" } });
      expect((await as(app, admin, "delete", `/api/admin/users/${yo.id}`)).body.code).toBe(
        "SELF_DELETE",
      );

      const nueva = await as(app, admin, "post", "/api/admin/users").send({
        email: "temporal@signal.test",
        name: "Temporal",
        role: "EDITOR",
      });
      const id = nueva.body.user.id;
      expect((await as(app, editor, "delete", `/api/admin/users/${id}`)).status).toBe(403);
      expect((await as(app, admin, "delete", `/api/admin/users/${id}`)).status).toBe(204);
      expect(await db.user.findUnique({ where: { id } })).toBeNull();

      // El editor sube una imagen: su cuenta ya tiene autoría.
      await as(app, editor, "post", "/api/admin/media").attach("archivo", await png(), "a.png");
      const ed = await db.user.findUniqueOrThrow({ where: { email: "editor@signal.test" } });
      const conAutoria = await as(app, admin, "delete", `/api/admin/users/${ed.id}`);
      expect(conAutoria.status).toBe(409);
      expect(conAutoria.body.code).toBe("USER_HAS_CONTENT");
    });

    it("impide desactivarse o quitarse el rol a sí mismo", async () => {
      const yo = await db.user.findUniqueOrThrow({ where: { email: "admin@signal.test" } });
      const desactivar = await as(app, admin, "patch", `/api/admin/users/${yo.id}`).send({
        active: false,
      });
      const degradar = await as(app, admin, "patch", `/api/admin/users/${yo.id}`).send({
        role: "EDITOR",
      });
      expect([desactivar.body.code, degradar.body.code]).toEqual(["SELF_LOCKOUT", "SELF_LOCKOUT"]);
      // Cambiar el propio nombre sí está permitido.
      expect(
        (await as(app, admin, "patch", `/api/admin/users/${yo.id}`).send({ name: "Yo" })).status,
      ).toBe(200);
    });

    it("dos admins que se quitan el rol a la vez no dejan el sitio sin administración", async () => {
      const a = await db.user.findUniqueOrThrow({ where: { email: "admin@signal.test" } });
      const b = await createUser(db, {
        email: "admin2@signal.test",
        password: CLAVE,
        role: "ADMIN",
      });
      const sb = await login(app, "admin2@signal.test", CLAVE);
      const [r1, r2] = await Promise.all([
        as(app, admin, "patch", `/api/admin/users/${b.id}`).send({ role: "EDITOR" }),
        as(app, sb, "patch", `/api/admin/users/${a.id}`).send({ role: "EDITOR" }),
      ]);
      // Según cómo se crucen, la segunda petición choca con el bloqueo (409 LAST_ADMIN)
      // o llega cuando quien la hace ya perdió el rol (403). Lo que importa es el invariante.
      const estados = [r1.status, r2.status].sort();
      expect([
        [200, 403],
        [200, 409],
      ]).toContainEqual(estados);
      expect(await db.user.count({ where: { role: "ADMIN", active: true } })).toBe(1);
    });

    it("desactivar una cuenta corta su sesión al instante", async () => {
      const ed = await db.user.findUniqueOrThrow({ where: { email: "editor@signal.test" } });
      await as(app, admin, "patch", `/api/admin/users/${ed.id}`).send({ active: false });
      expect((await as(app, editor, "get", "/api/admin/auth/me")).status).toBe(401);
    });

    it("restablece la contraseña y desbloquea la cuenta", async () => {
      const ed = await db.user.update({
        where: { email: "editor@signal.test" },
        data: { lockedUntil: new Date(Date.now() + 3_600_000) },
      });
      const res = await as(app, admin, "post", `/api/admin/users/${ed.id}/reset-password`);
      expect(res.status).toBe(200);
      expect(res.body.user.mustChangePassword).toBe(true);
      expect((await as(app, editor, "get", "/api/admin/auth/me")).status).toBe(401);
      await login(app, "editor@signal.test", res.body.temporaryPassword);
    });
  });

  describe("beacons", () => {
    it("crea, mueve major/minor de forma atómica y la app ve el cambio", async () => {
      const crear = await as(app, admin, "post", "/api/admin/beacons").send({
        major: "1",
        minor: "1",
        titulo: "Recepción",
        descripcion: "Estás en la recepción.",
      });
      expect(crear.status).toBe(201);
      expect(crear.body.beacon).toMatchObject({ clave: "1-1", completo: false, ubicacion: null });

      const dup = await as(app, admin, "post", "/api/admin/beacons").send({
        major: 1,
        minor: 1,
        titulo: "x",
        descripcion: "y",
      });
      expect(dup.status).toBe(409);
      expect(dup.body.campos.minor).toMatch(/Ya existe un beacon 1-1/);

      const mover = await as(app, admin, "put", `/api/admin/beacons/${crear.body.beacon.id}`).send({
        major: 2,
        minor: 5,
        titulo: "Recepción",
        descripcion: "Estás en la recepción.",
        ubicacion: "Planta baja",
      });
      expect(mover.body.beacon).toMatchObject({ clave: "2-5", completo: true });

      expect((await request(app).get("/beacons/1/1")).status).toBe(404);
      expect((await request(app).get("/beacons/2/5")).body).toEqual({
        titulo: "Recepción",
        descripcion: "Estás en la recepción.",
        ubicacion: "Planta baja",
      });
      const snapshot = JSON.parse(readFileSync(env.beaconSnapshotPath, "utf-8"));
      expect(Object.keys(snapshot)).toEqual(["2-5"]);

      const lista = await as(app, admin, "get", "/api/admin/beacons");
      expect(lista.body.resumen).toEqual({ total: 1, completos: 1, incompletos: 0 });

      expect(
        (await as(app, admin, "delete", `/api/admin/beacons/${crear.body.beacon.id}`)).status,
      ).toBe(204);
      expect((await request(app).get("/beacons/2/5")).status).toBe(404);
    });

    it("valida el rango y los campos obligatorios", async () => {
      const res = await as(app, admin, "post", "/api/admin/beacons").send({
        major: 70000,
        minor: "x",
        titulo: "",
      });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.campos).sort()).toEqual([
        "descripcion",
        "major",
        "minor",
        "titulo",
      ]);
    });
  });

  describe("formulario de contacto", () => {
    const mensaje = {
      nombre: "Ana",
      correo: "ana@correo.cl",
      mensaje: "Quiero llevar SIGNAL a mi edificio.",
    };

    it("guarda el mensaje, responde con el texto de la sección y el admin lo ve", async () => {
      const res = await request(app).post("/api/public/contact").send(mensaje);
      expect(res.status).toBe(201);
      expect(res.body.mensaje).toBe("Recibimos tu mensaje. Te responderemos a la brevedad.");
      const lista = await as(app, admin, "get", "/api/admin/messages");
      expect(lista.body.noLeidos).toBe(1);
      const id = lista.body.items[0].id;
      await as(app, admin, "patch", `/api/admin/messages/${id}`).send({ leido: true });
      expect((await as(app, admin, "get", "/api/admin/messages")).body.noLeidos).toBe(0);
    });

    it("descarta en silencio lo que llena el campo trampa", async () => {
      const res = await request(app)
        .post("/api/public/contact")
        .send({ ...mensaje, sitioWeb: "http://spam" });
      expect(res.status).toBe(201);
      expect(await db.contactMessage.count()).toBe(0);
    });

    it("indica qué campo corregir", async () => {
      const res = await request(app)
        .post("/api/public/contact")
        .send({ nombre: "", correo: "x", mensaje: "corto" });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.campos).sort()).toEqual(["correo", "mensaje", "nombre"]);
    });

    it("limita a 5 mensajes por hora por IP", async () => {
      for (let i = 0; i < 5; i++) await request(app).post("/api/public/contact").send(mensaje);
      const res = await request(app).post("/api/public/contact").send(mensaje);
      expect(res.status).toBe(429);
    });
  });

  it("la cookie de una sesión renovada sigue funcionando tras subir archivos", async () => {
    // Regresión: multer no debe consumir la validación CSRF.
    const res = await as(app, admin, "get", "/api/admin/auth/csrf");
    const renovada = {
      cookie: `${admin.cookie}; ${cookieHeader(res.headers["set-cookie"])}`,
      csrfToken: res.body.csrfToken,
    };
    expect(
      (await as(app, renovada, "post", "/api/admin/media").attach("archivo", await png(), "a.png"))
        .status,
    ).toBe(201);
  });
});
