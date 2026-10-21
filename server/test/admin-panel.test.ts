import { Writable } from "node:stream";
import { pino } from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "./helpers/app.js";
import { TEST_ADMIN_PATH } from "./helpers/env.js";

// La ruta del panel es secreta, pero no es la seguridad real: estas pruebas
// verifican que el panel solo existe bajo /<ADMIN_PATH> y que fuera de ella nada
// lo delata (ni redirecciones, ni cabeceras, ni logs).

const BASE = `/${TEST_ADMIN_PATH}`;
const app = buildTestApp();

describe("panel bajo la ruta oculta", () => {
  it("sirve el HTML del panel con <base>, noindex y sin caché", async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.text).toContain(`<base href="${BASE}/">`);
    expect(res.text).toContain('<meta name="robots" content="noindex, nofollow">');
  });

  it.each([`${BASE}/`, `${BASE}/noticias/123`, `${BASE}/admin.html`])(
    "%s devuelve el HTML del panel (rutas del SPA)",
    async (ruta) => {
      const res = await request(app).get(ruta);
      expect(res.status).toBe(200);
      expect(res.text).toContain(`<base href="${BASE}/">`);
    },
  );

  it("sirve los assets con caché inmutable y noindex", async () => {
    const res = await request(app).get(`${BASE}/assets/app-abc123.js`);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("immutable");
    expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
  });

  it("un asset inexistente es 404, no el HTML del panel", async () => {
    const res = await request(app).get(`${BASE}/assets/no-existe.js`);
    expect(res.status).toBe(404);
    expect(res.text).not.toContain("<base");
  });

  it("responde 503 con instrucciones si el panel no está compilado", async () => {
    const sinBuild = buildTestApp({ env: { ADMIN_DIST_DIR: "no-existe" } });
    const res = await request(sinBuild).get(BASE);
    expect(res.status).toBe(503);
    expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
  });
});

describe("fuera de la ruta oculta el panel no existe", () => {
  it.each([
    "/admin",
    "/admin/login",
    "/login",
    "/panel",
    "/dashboard",
    "/admin.html",
    "/assets/app-abc123.js",
    BASE.toUpperCase(),
    `${BASE}x`,
    `/x${BASE}`,
  ])("%s → 404 sin redirección", async (ruta) => {
    const res = await request(app).get(ruta);
    expect(res.status).toBe(404);
    expect(res.headers.location).toBeUndefined();
    expect(res.headers["x-robots-tag"]).toBeUndefined();
    expect(res.text).not.toContain(TEST_ADMIN_PATH);
  });

  it("/api/admin/* sin sesión responde 401, exista o no la ruta", async () => {
    for (const ruta of ["/api/admin/auth/me", "/api/admin/audit", "/api/admin/no-existe"]) {
      const res = await request(app).get(ruta);
      expect(res.status, ruta).toBe(401);
      expect(res.body.code).toBe("UNAUTHENTICATED");
    }
    expect((await request(app).post("/api/admin/beacons").send({})).status).toBe(401);
  });
});

describe("cabeceras de seguridad", () => {
  it("aplica CSP, nosniff y bloqueo de iframes", async () => {
    const res = await request(app).get("/no-existe");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("no envía cabeceras CORS a otros orígenes", async () => {
    const res = await request(app).get("/api/health").set("Origin", "https://otro-sitio.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("permite CORS solo a los orígenes configurados", async () => {
    const conCors = buildTestApp({ env: { CORS_ORIGINS: "https://signal.cl" } });
    const res = await request(conCors).get("/api/health").set("Origin", "https://signal.cl");
    expect(res.headers["access-control-allow-origin"]).toBe("https://signal.cl");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("rechaza peticiones que modifican datos desde otro origen", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .set("Origin", "https://atacante.com")
      .send({ email: "a@b.cl", password: "x" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ORIGIN_NOT_ALLOWED");
  });
});

it("la ruta oculta no aparece en los logs de acceso", async () => {
  let logs = "";
  const destino = new Writable({
    write(chunk, _enc, cb) {
      logs += chunk.toString();
      cb();
    },
  });
  const conLogs = buildTestApp({ logger: pino({ level: "info" }, destino) });
  await request(conLogs).get(`${BASE}/noticias`);
  expect(logs).toContain("/<panel>/noticias");
  expect(logs).not.toContain(TEST_ADMIN_PATH);
});
