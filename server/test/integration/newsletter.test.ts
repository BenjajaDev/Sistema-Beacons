import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, seedContent, testDb } from "../helpers/db.js";
import { as, login, type TestSession } from "../helpers/session.js";

const CLAVE = "Clave-Segura-De-Prueba-1";

describe.skipIf(!hasTestDb)("boletín", () => {
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

  const suscribir = (body: object) => request(app).post("/api/public/newsletter").send(body);

  it("exige el consentimiento expreso y un correo válido", async () => {
    const sin = await suscribir({ correo: "ana@example.cl" });
    expect(sin.status).toBe(400);
    expect(sin.body.campos.consentimiento).toMatch(/casilla/);
    const falso = await suscribir({ correo: "ana@example.cl", consentimiento: false });
    expect(falso.status).toBe(400);
    const malo = await suscribir({ correo: "ana", consentimiento: true });
    expect(malo.body.campos.correo).toMatch(/correo válido/);
    expect(await db.subscriber.count()).toBe(0);
  });

  it("guarda el correo en minúsculas con el texto del consentimiento aceptado", async () => {
    const res = await suscribir({
      correo: "  Ana.Rojas@Example.CL ",
      nombre: "Ana",
      consentimiento: true,
    });
    expect(res.status).toBe(201);
    expect(res.headers["cache-control"]).toBe("no-store");
    const fila = await db.subscriber.findUniqueOrThrow({
      where: { email: "ana.rojas@example.cl" },
    });
    expect(fila).toMatchObject({ name: "Ana", unsubscribedAt: null });
    expect(fila.consentText).toMatch(/Acepto recibir por correo el boletín de SIGNAL/);
    expect(fila.token.length).toBeGreaterThanOrEqual(30);
    expect(Math.abs(fila.consentAt.getTime() - Date.now())).toBeLessThan(10_000);
  });

  it("usa el texto de consentimiento y el mensaje que edita el equipo", async () => {
    await db.section.update({
      where: { key: "boletin" },
      data: {
        content: {
          titulo: "Boletín",
          textoConsentimiento: "Quiero el boletín (texto del equipo).",
          textoBoton: "Suscribirme",
          mensajeExito: "¡Bienvenida o bienvenido!",
        },
      },
    });
    const res = await suscribir({ correo: "luis@example.cl", consentimiento: true });
    expect(res.body.mensaje).toBe("¡Bienvenida o bienvenido!");
    const fila = await db.subscriber.findUniqueOrThrow({ where: { email: "luis@example.cl" } });
    expect(fila.consentText).toBe("Quiero el boletín (texto del equipo).");
  });

  it("responde igual si el correo ya estaba, sin duplicarlo ni revelar que existe", async () => {
    const a = await suscribir({ correo: "ana@example.cl", consentimiento: true });
    const b = await suscribir({ correo: "ANA@example.cl", consentimiento: true });
    expect(b.status).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(await db.subscriber.count()).toBe(1);
  });

  it("el campo trampa no guarda nada y responde como si hubiera funcionado", async () => {
    const res = await suscribir({
      correo: "bot@example.cl",
      consentimiento: true,
      sitioWeb: "http://spam",
    });
    expect(res.status).toBe(201);
    expect(await db.subscriber.count()).toBe(0);
  });

  it("se da de baja con el enlace secreto, y volver a suscribirse es un consentimiento nuevo", async () => {
    await suscribir({ correo: "ana@example.cl", consentimiento: true });
    const { token } = await db.subscriber.findUniqueOrThrow({ where: { email: "ana@example.cl" } });

    expect(
      (
        await request(app)
          .post("/api/public/newsletter/unsubscribe")
          .send({ token: "x".repeat(32) })
      ).status,
    ).toBe(404);
    expect((await request(app).post("/api/public/newsletter/unsubscribe").send({})).status).toBe(
      400,
    );

    const baja = await request(app).post("/api/public/newsletter/unsubscribe").send({ token });
    expect(baja.status).toBe(200);
    const dada = await db.subscriber.findUniqueOrThrow({ where: { email: "ana@example.cl" } });
    expect(dada.unsubscribedAt).not.toBeNull();
    // Repetir el enlace no falla ni cambia la fecha.
    await request(app).post("/api/public/newsletter/unsubscribe").send({ token });
    expect(
      (await db.subscriber.findUniqueOrThrow({ where: { email: "ana@example.cl" } }))
        .unsubscribedAt,
    ).toEqual(dada.unsubscribedAt);

    await suscribir({ correo: "ana@example.cl", consentimiento: true, nombre: "Ana R." });
    const de_nuevo = await db.subscriber.findUniqueOrThrow({ where: { email: "ana@example.cl" } });
    expect(de_nuevo).toMatchObject({ unsubscribedAt: null, name: "Ana R.", token });
  });

  it("limita las solicitudes por conexión", async () => {
    let ultimo = 0;
    for (let i = 0; i < 8; i++) {
      ultimo = (await suscribir({ correo: `p${i}@example.cl`, consentimiento: true })).status;
    }
    expect(ultimo).toBe(429);
  });

  it("administración y comunicación ven a los suscriptores; la edición no", async () => {
    await suscribir({ correo: "ana@example.cl", consentimiento: true });
    await suscribir({ correo: "luis@example.cl", consentimiento: true });
    const { token } = await db.subscriber.findUniqueOrThrow({
      where: { email: "luis@example.cl" },
    });
    await request(app).post("/api/public/newsletter/unsubscribe").send({ token });

    expect((await as(app, editor, "get", "/api/admin/subscribers")).status).toBe(403);
    expect((await as(app, editor, "get", "/api/admin/subscribers/export")).status).toBe(403);

    const activos = await as(app, social, "get", "/api/admin/subscribers");
    expect(activos.body.items.map((s: { email: string }) => s.email)).toEqual(["ana@example.cl"]);
    expect(activos.body.resumen).toEqual({ activos: 1, bajas: 1 });
    // El enlace secreto de baja no sale en la lista.
    expect(activos.body.items[0].token).toBeUndefined();

    const bajas = await as(app, admin, "get", "/api/admin/subscribers?estado=bajas");
    expect(bajas.body.items.map((s: { email: string }) => s.email)).toEqual(["luis@example.cl"]);
    expect(
      (await as(app, admin, "get", "/api/admin/subscribers?estado=todos")).body.items,
    ).toHaveLength(2);
  });

  it("exporta solo a quienes siguen suscritos, con su enlace de baja y sin fórmulas", async () => {
    await suscribir({
      correo: "ana@example.cl",
      nombre: '=HYPERLINK("http://malo")',
      consentimiento: true,
    });
    await suscribir({ correo: "luis@example.cl", consentimiento: true });
    const luis = await db.subscriber.findUniqueOrThrow({ where: { email: "luis@example.cl" } });
    await request(app).post("/api/public/newsletter/unsubscribe").send({ token: luis.token });

    const res = await as(app, social, "get", "/api/admin/subscribers/export");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("suscriptores-boletin.csv");
    const csv = res.text.replace(new RegExp(`^${String.fromCharCode(0xfeff)}`), "");
    const lineas = csv.trim().split("\r\n");
    expect(lineas[0]).toBe('"correo","nombre","consentimiento","enlace_de_baja"');
    expect(lineas).toHaveLength(2);
    expect(lineas[1]).toContain('"ana@example.cl"');
    // Excel no debe ejecutar el nombre como fórmula.
    expect(lineas[1]).toContain(`"'=HYPERLINK(""http://malo"")"`);
    const ana = await db.subscriber.findUniqueOrThrow({ where: { email: "ana@example.cl" } });
    expect(lineas[1]).toMatch(new RegExp(`/boletin/baja\\?t=${ana.token}"$`));
    expect(csv).not.toContain("luis@example.cl");

    // El registro dice cuántos se descargaron, no a quiénes.
    const registro = await db.auditLog.findFirstOrThrow({
      where: { action: "SUBSCRIBERS_EXPORT" },
    });
    expect(registro.meta).toEqual({ cantidad: 1 });
  });

  it("elimina por completo a una persona y lo registra sin su correo", async () => {
    await suscribir({ correo: "ana@example.cl", consentimiento: true });
    const ana = await db.subscriber.findUniqueOrThrow({ where: { email: "ana@example.cl" } });
    expect((await as(app, editor, "delete", `/api/admin/subscribers/${ana.id}`)).status).toBe(403);
    expect((await as(app, social, "delete", `/api/admin/subscribers/${ana.id}`)).status).toBe(204);
    expect(await db.subscriber.count()).toBe(0);
    expect((await as(app, social, "delete", `/api/admin/subscribers/${ana.id}`)).status).toBe(404);
    const registros = await db.auditLog.findMany({ where: { action: "SUBSCRIBER_DELETE" } });
    expect(JSON.stringify(registros)).not.toContain("ana@example.cl");
  });

  it("la sección del boletín nace oculta y la página de baja no se indexa", async () => {
    expect((await db.section.findUniqueOrThrow({ where: { key: "boletin" } })).visible).toBe(false);
    const pagina = await request(app).get("/boletin/baja?t=abc");
    expect(pagina.status).toBe(200);
    expect(pagina.text).toContain('<meta name="robots" content="noindex">');
    expect(pagina.headers["referrer-policy"]).toBe("no-referrer");
    expect((await request(app).get("/sitemap.xml")).text).not.toContain("boletin");
  });
});
