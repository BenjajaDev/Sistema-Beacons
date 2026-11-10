import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { EDGE_CLIENT_IP_HEADER, EDGE_SECRET_HEADER } from "../src/http/edge-contract.js";
import { edgeGate } from "../src/http/edge-gate.js";
import { buildTestApp } from "./helpers/app.js";

// Detrás de Cloudflare Pages, el servidor solo atiende lo que trae el secreto de
// la Function: la URL del host no debe servir para saltarse Cloudflare ni para
// falsear la IP con la que se aplican los límites y se escribe la bitácora.

const SECRETO = "secreto-de-la-function-0123456789abcdef0123";
const conGate = buildTestApp({ env: { EDGE_PROXY_SECRET: SECRETO } });
const sinGate = buildTestApp();

describe("sin EDGE_PROXY_SECRET", () => {
  it("atiende las peticiones sin cabeceras de Cloudflare", async () => {
    const res = await request(sinGate).get("/robots.txt");
    expect(res.status).toBe(200);
  });
});

describe("con EDGE_PROXY_SECRET", () => {
  it.each(["/robots.txt", "/beacons/1/1", "/api/public/site", "/"])(
    "%s sin el secreto responde 404 en JSON, sin revelar por qué",
    async (ruta) => {
      const res = await request(conGate).get(ruta);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: "NOT_FOUND" });
      expect(JSON.stringify(res.body)).not.toMatch(/secreto|cloudflare|edge/i);
    },
  );

  it("rechaza un secreto incorrecto, aunque tenga la misma longitud", async () => {
    const res = await request(conGate)
      .get("/robots.txt")
      .set(EDGE_SECRET_HEADER, SECRETO.replace(/.$/, "X"));
    expect(res.status).toBe(404);
  });

  it("atiende la petición con el secreto correcto", async () => {
    const res = await request(conGate).get("/robots.txt").set(EDGE_SECRET_HEADER, SECRETO);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Sitemap:");
  });

  it.each(["/api/health", "/api/health/live"])(
    "%s responde sin el secreto (health check del host)",
    async (ruta) => {
      const res = await request(conGate).get(ruta);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ok: true });
    },
  );
});

describe("IP de quien visita", () => {
  function appQueMuestraLaIp() {
    const app = express();
    app.use(edgeGate(SECRETO));
    app.get("/ip", (req, res) => {
      res.json({ ip: req.ip });
    });
    return app;
  }

  it("usa la IP que informa la Function cuando trae el secreto", async () => {
    const res = await request(appQueMuestraLaIp())
      .get("/ip")
      .set(EDGE_SECRET_HEADER, SECRETO)
      .set(EDGE_CLIENT_IP_HEADER, "203.0.113.7");
    expect(res.body).toEqual({ ip: "203.0.113.7" });
  });

  it("acepta IPv6", async () => {
    const res = await request(appQueMuestraLaIp())
      .get("/ip")
      .set(EDGE_SECRET_HEADER, SECRETO)
      .set(EDGE_CLIENT_IP_HEADER, "2001:db8::1");
    expect(res.body).toEqual({ ip: "2001:db8::1" });
  });

  it("ignora un valor que no es una IP", async () => {
    const res = await request(appQueMuestraLaIp())
      .get("/ip")
      .set(EDGE_SECRET_HEADER, SECRETO)
      .set(EDGE_CLIENT_IP_HEADER, "no-es-una-ip");
    expect(res.body.ip).not.toBe("no-es-una-ip");
  });
});

describe("origen permitido detrás de Cloudflare", () => {
  // El servidor ve el host de su plataforma (Render); el navegador envía el dominio público.
  const app = buildTestApp({
    env: { EDGE_PROXY_SECRET: SECRETO, SITE_URL: "https://signal.example" },
  });

  it("acepta Origin igual a SITE_URL", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .set(EDGE_SECRET_HEADER, SECRETO)
      .set("Origin", "https://signal.example")
      .send({});
    expect(res.body.code).not.toBe("ORIGIN_NOT_ALLOWED");
  });

  it("sigue rechazando otros orígenes", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .set(EDGE_SECRET_HEADER, SECRETO)
      .set("Origin", "https://otro-sitio.example")
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ORIGIN_NOT_ALLOWED");
  });
});

describe("validación de EDGE_PROXY_SECRET", () => {
  it("exige al menos 32 caracteres", () => {
    expect(() => buildTestApp({ env: { EDGE_PROXY_SECRET: "corto" } })).toThrow(
      /EDGE_PROXY_SECRET debe tener al menos 32 caracteres/,
    );
  });

  it("no puede repetir JWT_SECRET", () => {
    expect(() =>
      buildTestApp({ env: { EDGE_PROXY_SECRET: "jwt-secreto-de-prueba-0123456789abcdef0123" } }),
    ).toThrow(/EDGE_PROXY_SECRET debe ser distinto/);
  });
});
