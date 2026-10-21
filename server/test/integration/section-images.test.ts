import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMissingSections } from "../../src/content/section-catalog.js";
import { SECTION_DEFINITIONS } from "../../src/content/sections.js";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, seedContent, testDb } from "../helpers/db.js";
import { as, login, type TestSession } from "../helpers/session.js";

const CLAVE = "Clave-Segura-De-Prueba-1";

const png = () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: "#004AAD" } })
    .png()
    .toBuffer();

describe.skipIf(!hasTestDb)("imágenes en las secciones", () => {
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

  async function subirImagen() {
    const res = await as(app, admin, "post", "/api/admin/media").attach(
      "archivo",
      await png(),
      "f.png",
    );
    return res.body.media as { id: string; url: string };
  }

  async function publicar(key: string, content: object) {
    const guardado = await as(app, admin, "put", `/api/admin/sections/${key}/draft`).send({
      content,
    });
    if (guardado.status !== 200) return guardado;
    return as(app, admin, "post", `/api/admin/sections/${key}/publish`);
  }

  const seccionPublica = async (pagina: string, key: string) => {
    const res = await request(app).get(`/api/public/pages/${pagina}`);
    return res.body.secciones.find((s: { key: string }) => s.key === key)?.content;
  };

  it("guarda la URL y el tamaño reales y la landing no recibe el id", async () => {
    const media = await subirImagen();
    const res = await publicar("hero", {
      ...SECTION_DEFINITIONS.hero.contenidoInicial,
      imagen: { mediaId: media.id, alt: "Persona con bastón frente a una puerta" },
    });
    expect(res.status).toBe(200);
    expect(res.body.section.content.imagen).toMatchObject({
      mediaId: media.id,
      url: media.url,
      width: 64,
      height: 48,
    });
    expect((await seccionPublica("inicio", "hero")).imagen).toEqual({
      url: media.url,
      width: 64,
      height: 48,
      alt: "Persona con bastón frente a una puerta",
    });
  });

  it("acepta una imagen por paso y una en el encabezado", async () => {
    const media = await subirImagen();
    const imagen = { mediaId: media.id, alt: "", decorativa: true };
    const res = await publicar("que-es", {
      titulo: "Qué es",
      imagen,
      pasos: [
        { titulo: "Uno", texto: "Primero", imagen },
        { titulo: "Dos", texto: "Segundo" },
      ],
    });
    expect(res.status).toBe(200);
    const publico = await seccionPublica("inicio", "que-es");
    expect(publico.imagen).toMatchObject({ url: media.url, alt: "" });
    expect(publico.pasos[0].imagen).toMatchObject({ url: media.url, alt: "" });
    expect(publico.pasos[1].imagen).toBeUndefined();
  });

  it("exige texto alternativo o marcarla como decorativa, e indica el campo", async () => {
    const media = await subirImagen();
    const res = await as(app, admin, "put", "/api/admin/sections/objetivos/draft").send({
      content: {
        titulo: "Objetivos",
        items: [{ titulo: "A", texto: "B", imagen: { mediaId: media.id, alt: "" } }],
      },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.campos)).toEqual(["items.0.imagen.alt"]);
  });

  it("rechaza una imagen que no está en la biblioteca", async () => {
    const res = await as(app, admin, "put", "/api/admin/sections/hero/draft").send({
      content: {
        ...SECTION_DEFINITIONS.hero.contenidoInicial,
        imagen: { mediaId: "0e4f3c1a-5b7d-4a2e-9c8f-1d2b3a4c5e6f", alt: "x" },
      },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.campos)).toEqual(["imagen.mediaId"]);
  });

  it("no deja borrar una imagen usada en una sección, ni siquiera en un borrador", async () => {
    const media = await subirImagen();
    await as(app, admin, "put", "/api/admin/sections/contacto/draft").send({
      content: {
        ...SECTION_DEFINITIONS.contacto.contenidoInicial,
        imagen: { mediaId: media.id, alt: "Oficina del equipo" },
      },
    });
    const res = await as(app, admin, "delete", `/api/admin/media/${media.id}`);
    expect(res.status).toBe(409);
    expect(res.body.usos).toEqual(["la sección «contacto»"]);
  });

  it("el bloque imagen y texto nace oculto y se puede publicar", async () => {
    expect((await seccionPublica("inicio", "imagen-texto-inicio")) ?? null).toBeNull();
    const media = await subirImagen();
    await publicar("imagen-texto-inicio", {
      titulo: "En terreno",
      texto: "Instalamos los primeros beacons.",
      imagen: { mediaId: media.id, alt: "Beacon pegado en un muro" },
      posicion: "izquierda",
      accion: { texto: "Contáctanos", href: "/contacto" },
    });
    await as(app, admin, "patch", "/api/admin/sections/imagen-texto-inicio/visibility").send({
      visible: true,
    });
    expect(await seccionPublica("inicio", "imagen-texto-inicio")).toMatchObject({
      titulo: "En terreno",
      posicion: "izquierda",
      imagen: { url: media.url, alt: "Beacon pegado en un muro" },
    });
  });

  it("una base existente recibe las secciones nuevas del catálogo sin tocar las suyas", async () => {
    await db.section.deleteMany({ where: { key: { startsWith: "imagen-texto-" } } });
    await db.section.update({ where: { key: "hero" }, data: { order: 99 } });
    expect(await createMissingSections(db)).toEqual([
      "imagen-texto-inicio",
      "imagen-texto-nosotros",
    ]);
    expect(await createMissingSections(db)).toEqual([]);
    expect((await db.section.findUnique({ where: { key: "hero" } }))?.order).toBe(99);
    expect(
      (await db.section.findUnique({ where: { key: "imagen-texto-nosotros" } }))?.visible,
    ).toBe(false);
  });
});

describe.skipIf(!hasTestDb)("datos de la card del equipo", () => {
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

  it("guarda correo, área y formación y los publica; un campo vacío queda en null", async () => {
    const creado = await as(app, admin, "post", "/api/admin/team").send({
      name: "Sofía",
      position: "Diseño UX",
      email: "  sofia@signal.cl ",
      area: "Diseño",
      education: "Diseño, Universidad de Chile",
    });
    expect(creado.status).toBe(201);
    const editado = await as(app, admin, "patch", `/api/admin/team/${creado.body.item.id}`).send({
      area: "",
    });
    expect(editado.body.item).toMatchObject({ email: "sofia@signal.cl", area: null });

    const [publica] = (await request(app).get("/api/public/team")).body.items;
    expect(publica).toMatchObject({
      name: "Sofía",
      email: "sofia@signal.cl",
      area: null,
      education: "Diseño, Universidad de Chile",
    });
  });

  it("valida el correo e indica el campo", async () => {
    const res = await as(app, admin, "post", "/api/admin/team").send({
      name: "Luis",
      position: "Desarrollo",
      email: "luis-en-signal",
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.campos)).toEqual(["email"]);
  });
});
