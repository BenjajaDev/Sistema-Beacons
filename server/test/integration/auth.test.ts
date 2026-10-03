import { Writable } from "node:stream";
import { pino } from "pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db.js";
import { as, cookieHeader, login } from "../helpers/session.js";

const CLAVE = "Clave-Segura-De-Prueba-1";
const ADMIN = "admin@signal.test";
const EDITOR = "editor@signal.test";

describe.skipIf(!hasTestDb)("autenticación", () => {
  let db: Db;
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(() => {
    db = testDb();
  });
  afterAll(() => db?.$disconnect());

  beforeEach(async () => {
    // App nueva en cada test: el límite de intentos por IP vive en memoria.
    app = buildTestApp({ db });
    await resetDb(db);
    await createUser(db, { email: ADMIN, password: CLAVE, role: "ADMIN" });
    await createUser(db, { email: EDITOR, password: CLAVE, role: "EDITOR" });
  });

  describe("login", () => {
    it("crea una sesión con cookies httpOnly, Secure, SameSite=Strict y prefijo __Host-", async () => {
      const res = await request(app)
        .post("/api/admin/auth/login")
        .send({ email: " Admin@Signal.TEST ", password: CLAVE });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ email: ADMIN, role: "ADMIN" });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(typeof res.body.csrfToken).toBe("string");

      const cookies = res.headers["set-cookie"] as unknown as string[];
      for (const nombre of ["__Host-signal_session", "__Host-signal_csrf"]) {
        const c = cookies.find((x) => x.startsWith(`${nombre}=`));
        expect(c, nombre).toBeDefined();
        expect(c).toMatch(/; HttpOnly/);
        expect(c).toMatch(/; Secure/);
        expect(c).toMatch(/; SameSite=Strict/);
        expect(c).toMatch(/; Path=\//);
        expect(c).not.toMatch(/Domain=/);
      }
      const log = await db.auditLog.findFirst({ where: { action: "LOGIN_OK" } });
      expect(log?.ip).toBeTruthy();
    });

    it("da el mismo error para contraseña incorrecta y correo inexistente", async () => {
      const mala = await request(app)
        .post("/api/admin/auth/login")
        .send({ email: ADMIN, password: "otra-cosa-123456" });
      const inexistente = await request(app)
        .post("/api/admin/auth/login")
        .send({ email: "nadie@signal.test", password: CLAVE });
      expect(mala.status).toBe(401);
      expect(inexistente.status).toBe(401);
      expect(mala.body).toEqual(inexistente.body);
      expect(mala.body.code).toBe("INVALID_CREDENTIALS");
    });

    it("valida los campos y dice cuál falta", async () => {
      const res = await request(app).post("/api/admin/auth/login").send({ email: ADMIN });
      expect(res.status).toBe(400);
      expect(res.body.campos.password).toBe("Escribe tu contraseña.");
    });

    it("bloquea la cuenta tras 5 intentos fallidos, incluso con la contraseña correcta", async () => {
      for (let i = 1; i <= 4; i++) {
        const r = await request(app)
          .post("/api/admin/auth/login")
          .send({ email: ADMIN, password: `mala-${i}-xxxxxxxx` });
        expect(r.status).toBe(401);
      }
      const quinto = await request(app)
        .post("/api/admin/auth/login")
        .send({ email: ADMIN, password: "mala-5-xxxxxxxx" });
      expect(quinto.status).toBe(429);
      expect(quinto.body.code).toBe("ACCOUNT_LOCKED");
      expect(quinto.body.error).toMatch(/15 minutos/);

      const correcta = await request(app)
        .post("/api/admin/auth/login")
        .send({ email: ADMIN, password: CLAVE });
      expect(correcta.status).toBe(429);

      // Pasado el bloqueo, vuelve a entrar y el contador se reinicia.
      await db.user.update({
        where: { email: ADMIN },
        data: { lockedUntil: new Date(Date.now() - 1000) },
      });
      expect(
        (await request(app).post("/api/admin/auth/login").send({ email: ADMIN, password: CLAVE }))
          .status,
      ).toBe(200);
      expect(await db.auditLog.count({ where: { action: "ACCOUNT_LOCKED" } })).toBe(1);
      expect(await db.auditLog.count({ where: { action: "LOGIN_FAIL" } })).toBe(4);
    });

    it("limita los intentos por IP aunque cambie el correo", async () => {
      const limitada = buildTestApp({ db, env: { LOGIN_RATE_LIMIT: "3" } });
      for (let i = 0; i < 3; i++) {
        await request(limitada)
          .post("/api/admin/auth/login")
          .send({ email: `x${i}@a.cl`, password: "x" });
      }
      const res = await request(limitada)
        .post("/api/admin/auth/login")
        .send({ email: ADMIN, password: CLAVE });
      expect(res.status).toBe(429);
      expect(res.body.code).toBe("RATE_LIMITED");
      expect(res.headers["retry-after"]).toBeDefined();
    });

    it("una cuenta desactivada no puede entrar y pierde su sesión abierta", async () => {
      const s = await login(app, EDITOR, CLAVE);
      await db.user.update({ where: { email: EDITOR }, data: { active: false } });
      expect((await as(app, s, "get", "/api/admin/auth/me")).status).toBe(401);
      const res = await request(app)
        .post("/api/admin/auth/login")
        .send({ email: EDITOR, password: CLAVE });
      expect(res.status).toBe(401);
    });
  });

  describe("sesión", () => {
    it("rechaza un JWT alterado", async () => {
      const s = await login(app, ADMIN, CLAVE);
      const alterada = s.cookie.replace(
        /(__Host-signal_session=[^.]+\.)[^.]+/,
        "$1eyJzdWIiOiJ4In0",
      );
      const res = await request(app).get("/api/admin/auth/me").set("Cookie", alterada);
      expect(res.status).toBe(401);
    });

    it("logout invalida la sesión", async () => {
      const s = await login(app, ADMIN, CLAVE);
      expect((await as(app, s, "post", "/api/admin/auth/logout")).status).toBe(204);
      expect((await as(app, s, "get", "/api/admin/auth/me")).status).toBe(401);
      expect(await db.auditLog.count({ where: { action: "LOGOUT" } })).toBe(1);
    });
  });

  describe("CSRF", () => {
    it("exige el token en peticiones que modifican datos", async () => {
      const s = await login(app, ADMIN, CLAVE);
      const sinToken = await request(app).post("/api/admin/auth/logout").set("Cookie", s.cookie);
      expect(sinToken.status).toBe(403);
      expect(sinToken.body.code).toBe("CSRF_INVALID");
    });

    it("no acepta el token de otra sesión", async () => {
      const a = await login(app, ADMIN, CLAVE);
      const b = await login(app, EDITOR, CLAVE);
      const res = await request(app)
        .post("/api/admin/auth/logout")
        .set("Cookie", a.cookie)
        .set("X-CSRF-Token", b.csrfToken);
      expect(res.status).toBe(403);
    });

    it("entrega un token nuevo para la sesión actual", async () => {
      const s = await login(app, ADMIN, CLAVE);
      const res = await as(app, s, "get", "/api/admin/auth/csrf");
      expect(res.status).toBe(200);
      const renovada = {
        cookie: `${s.cookie}; ${cookieHeader(res.headers["set-cookie"])}`,
        csrfToken: res.body.csrfToken,
      };
      expect((await as(app, renovada, "post", "/api/admin/auth/logout")).status).toBe(204);
    });
  });

  describe("cambio obligatorio de contraseña", () => {
    beforeEach(async () => {
      await db.user.update({ where: { email: ADMIN }, data: { mustChangePassword: true } });
    });

    it("bloquea el resto del panel hasta cambiarla", async () => {
      const s = await login(app, ADMIN, CLAVE);
      expect((await as(app, s, "get", "/api/admin/auth/me")).body.user.mustChangePassword).toBe(
        true,
      );
      const res = await as(app, s, "get", "/api/admin/audit");
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    });

    it("valida la contraseña actual y la nueva", async () => {
      const s = await login(app, ADMIN, CLAVE);
      const actualMala = await as(app, s, "post", "/api/admin/auth/change-password").send({
        currentPassword: "no-es-esta-1234",
        newPassword: "Nueva-Clave-Larga-2026",
      });
      expect(actualMala.status).toBe(400);
      expect(actualMala.body.campos.currentPassword).toBeDefined();

      const corta = await as(app, s, "post", "/api/admin/auth/change-password").send({
        currentPassword: CLAVE,
        newPassword: "corta",
      });
      expect(corta.body.campos.newPassword).toMatch(/12 caracteres/);

      const igual = await as(app, s, "post", "/api/admin/auth/change-password").send({
        currentPassword: CLAVE,
        newPassword: CLAVE,
      });
      expect(igual.body.campos.newPassword).toMatch(/distinta/);
    });

    it("al cambiarla, cierra las otras sesiones y deja esta habilitada", async () => {
      const otra = await login(app, ADMIN, CLAVE);
      const s = await login(app, ADMIN, CLAVE);
      const res = await as(app, s, "post", "/api/admin/auth/change-password").send({
        currentPassword: CLAVE,
        newPassword: "Nueva-Clave-Larga-2026",
      });
      expect(res.status).toBe(200);
      expect(res.body.user.mustChangePassword).toBe(false);

      const nueva = {
        cookie: cookieHeader(res.headers["set-cookie"]),
        csrfToken: res.body.csrfToken,
      };
      expect((await as(app, nueva, "get", "/api/admin/audit")).status).toBe(200);
      expect((await as(app, s, "get", "/api/admin/auth/me")).status).toBe(401);
      expect((await as(app, otra, "get", "/api/admin/auth/me")).status).toBe(401);
      expect(
        (await request(app).post("/api/admin/auth/login").send({ email: ADMIN, password: CLAVE }))
          .status,
      ).toBe(401);
    });
  });

  it("el JWT de sesión no queda en los logs de acceso", async () => {
    let logs = "";
    const destino = new Writable({
      write(chunk, _enc, cb) {
        logs += chunk.toString();
        cb();
      },
    });
    const conLogs = buildTestApp({ db, logger: pino({ level: "info" }, destino) });
    const res = await request(conLogs)
      .post("/api/admin/auth/login")
      .send({ email: ADMIN, password: CLAVE });
    const jwt = cookieHeader(res.headers["set-cookie"]).match(/__Host-signal_session=([^;]+)/)![1]!;
    expect(logs).toContain('"statusCode":200');
    expect(logs).not.toContain(jwt);
    expect(logs).not.toMatch(/set-cookie/i);
  });

  it("la bitácora registra quién hizo qué, filtrable por acción", async () => {
    await login(app, EDITOR, CLAVE);
    const s = await login(app, ADMIN, CLAVE);
    const res = await as(app, s, "get", "/api/admin/audit?action=LOGIN_OK&limit=1");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ action: "LOGIN_OK", user: { email: ADMIN } });
    expect(res.body.nextCursor).toBeTruthy();
    const siguiente = await as(
      app,
      s,
      "get",
      `/api/admin/audit?action=LOGIN_OK&cursor=${res.body.nextCursor}`,
    );
    expect(siguiente.body.items[0].user.email).toBe(EDITOR);
  });
});
