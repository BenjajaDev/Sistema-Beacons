import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_FOOTER } from "../../src/content/footer.js";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, seedContent, testDb } from "../helpers/db.js";
import { as, login, type TestSession } from "../helpers/session.js";

const CLAVE = "Clave-Segura-De-Prueba-1";

const png = () =>
  sharp({ create: { width: 40, height: 40, channels: 3, background: "#004AAD" } })
    .png()
    .toBuffer();

describe.skipIf(!hasTestDb)("logo e imagen del pie de página", () => {
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

  async function subir() {
    const res = await as(app, admin, "post", "/api/admin/media").attach(
      "archivo",
      await png(),
      "f.png",
    );
    return res.body.media as { id: string; url: string };
  }

  it("guarda el logo y la imagen con su URL, y la landing los recibe sin ids", async () => {
    const [logo, foto] = [await subir(), await subir()];
    const res = await as(app, admin, "put", "/api/admin/settings/footer").send({
      ...DEFAULT_FOOTER,
      logo: { mediaId: logo.id, alt: "", decorativa: true },
      imagen: { mediaId: foto.id, alt: "Beacon instalado sobre una puerta", decorativa: false },
    });
    expect(res.status).toBe(200);

    const { pie } = (await request(app).get("/api/public/site")).body;
    expect(pie.logo).toEqual({ url: logo.url, width: 40, height: 40, alt: "" });
    expect(pie.imagen).toEqual({
      url: foto.url,
      width: 40,
      height: 40,
      alt: "Beacon instalado sobre una puerta",
    });

    // El panel la ve con su URL (para la miniatura).
    const ajustes = await as(app, admin, "get", "/api/admin/settings");
    expect(ajustes.body.settings.footer.imagen.url).toBe(foto.url);

    // En uso: no se puede borrar.
    const borrar = await as(app, admin, "delete", `/api/admin/media/${foto.id}`);
    expect(borrar.status).toBe(409);
    expect(borrar.body.usos).toContain("el pie de página");
  });

  it("exige texto alternativo o marcarla como decorativa", async () => {
    const foto = await subir();
    const res = await as(app, admin, "put", "/api/admin/settings/footer").send({
      ...DEFAULT_FOOTER,
      imagen: { mediaId: foto.id, alt: "", decorativa: false },
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.campos)).toEqual(["imagen.alt"]);
  });

  it("sin logo ni imagen, el pie queda como antes", async () => {
    expect(
      (await as(app, admin, "put", "/api/admin/settings/footer").send(DEFAULT_FOOTER)).status,
    ).toBe(200);
    const { pie } = (await request(app).get("/api/public/site")).body;
    expect(pie).toEqual(DEFAULT_FOOTER);
  });
});
