import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../../src/lib/prisma.js";
import type { AdminRoute } from "../../src/routes/admin/registry.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db.js";
import { as, login } from "../helpers/session.js";

// Recorre TODAS las rutas declaradas en /api/admin (app.locals.adminRoutes) y
// verifica la matriz de permisos. Una ruta nueva entra aquí automáticamente.

const CLAVE = "Clave-Segura-De-Prueba-1";

function urlDe(ruta: AdminRoute) {
  return `/api/admin${ruta.path.replace(/:\w+/g, randomUUID())}`;
}
const nombre = (r: AdminRoute) => `${r.method.toUpperCase()} ${r.path} [${r.roles.join(", ")}]`;

// Política del proyecto, independiente de lo que declare cada ruta: estas rutas son
// SOLO de administración. Si alguien declara una por error como accesible a
// editores, este test falla aunque la matriz de abajo pase.
const SOLO_ADMIN = [
  /^\/audit(\/|$)/,
  /^\/users(\/|$)/,
  /^\/beacons(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/team(\/|$)/,
  /^\/collaborators(\/|$)/,
  /^\/messages(\/|$)/,
  /^\/news\/:\w+\/(publish|reject|unpublish)$/,
  /^\/sections\/:\w+\/(publish|visibility)$/,
  /^\/sections\/order$/,
];

describe("política de roles", () => {
  const rutas = buildTestApp().locals.adminRoutes as AdminRoute[];
  const protegidas = rutas.filter((r) => SOLO_ADMIN.some((p) => p.test(r.path)));

  it("cubre al menos la bitácora", () => {
    expect(protegidas.map((r) => r.path)).toContain("/audit");
  });

  it.each(protegidas.map((r) => [nombre(r), r] as const))("%s es solo para ADMIN", (_n, ruta) => {
    expect(ruta.roles).toEqual(["ADMIN"]);
  });
});

describe.skipIf(!hasTestDb)("matriz de permisos de /api/admin", () => {
  let db: Db;
  let servidor: ReturnType<typeof buildTestApp>;
  // it.each necesita la tabla antes de beforeAll: se lee de una app sin base de datos.
  const rutas = buildTestApp().locals.adminRoutes as AdminRoute[];

  beforeAll(async () => {
    db = testDb();
    // Límites altos: este test inicia muchas sesiones desde la misma IP.
    servidor = buildTestApp({ db, env: { LOGIN_RATE_LIMIT: "10000", API_RATE_LIMIT: "10000" } });
    await resetDb(db);
    await createUser(db, { email: "admin@signal.test", password: CLAVE, role: "ADMIN" });
    await createUser(db, { email: "editor@signal.test", password: CLAVE, role: "EDITOR" });
  });
  afterAll(() => db?.$disconnect());

  it("hay rutas registradas y todas declaran roles", () => {
    expect(rutas.length).toBeGreaterThan(0);
    for (const r of rutas) expect(r.roles.length, nombre(r)).toBeGreaterThan(0);
  });

  it.each(rutas.map((r) => [nombre(r), r] as const))("%s → 401 sin sesión", async (_n, ruta) => {
    const res = await request(servidor)[ruta.method](urlDe(ruta)).send({});
    expect(res.status).toBe(401);
  });

  const soloAdmin = rutas.filter((r) => !r.roles.includes("EDITOR"));
  it.each(soloAdmin.map((r) => [nombre(r), r] as const))(
    "%s → 403 para un editor, aunque llame a la API directamente",
    async (_n, ruta) => {
      const s = await login(servidor, "editor@signal.test", CLAVE);
      const res = await as(servidor, s, ruta.method, urlDe(ruta)).send({});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    },
  );

  it.each(rutas.map((r) => [nombre(r), r] as const))(
    "%s → el rol permitido pasa la autorización",
    async (_n, ruta) => {
      const email = ruta.roles.includes("EDITOR") ? "editor@signal.test" : "admin@signal.test";
      // Sesión nueva por ruta: logout o change-password invalidan la anterior.
      const s = await login(servidor, email, CLAVE);
      const res = await as(servidor, s, ruta.method, urlDe(ruta)).send({});
      expect([401, 403], `${res.status} ${JSON.stringify(res.body)}`).not.toContain(res.status);
    },
  );

  it("con sesión, una ruta inexistente es 404", async () => {
    const s = await login(servidor, "admin@signal.test", CLAVE);
    expect((await as(servidor, s, "get", "/api/admin/no-existe")).status).toBe(404);
  });
});
