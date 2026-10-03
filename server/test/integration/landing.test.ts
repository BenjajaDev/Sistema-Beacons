import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../../src/lib/prisma.js";
import { buildTestApp } from "../helpers/app.js";
import { createUser, hasTestDb, resetDb, seedContent, testDb } from "../helpers/db.js";
import { TEST_ADMIN_PATH } from "../helpers/env.js";

function datosIniciales(html: string) {
  const m = html.match(/<script type="application\/json" id="datos-iniciales">(.*?)<\/script>/s);
  if (!m) throw new Error("Sin datos iniciales");
  return JSON.parse(m[1]!) as { consultas: [unknown[], unknown][] };
}

describe.skipIf(!hasTestDb)("landing servida por Express", () => {
  let db: Db;
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(() => {
    db = testDb();
  });
  afterAll(() => db?.$disconnect());

  beforeEach(async () => {
    app = buildTestApp({ db });
    await resetDb(db);
    await seedContent(db);
    const autor = await createUser(db, {
      email: "a@signal.test",
      password: "Clave-Segura-1234",
      role: "ADMIN",
    });
    const base = {
      excerpt: "Bajada",
      category: "Proyecto",
      bodyJson: { type: "doc", content: [] },
      bodyHtml: "<p>x</p>",
      authorId: autor.id,
    };
    await db.news.create({
      data: {
        ...base,
        title: "Llega SIGNAL </script><script>alert(1)</script>",
        slug: "llega-signal",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    await db.news.create({ data: { ...base, title: "Borrador", slug: "borrador" } });
  });

  it("Inicio incluye título, descripción, tema y los datos para el primer render", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("<title>SIGNAL · Navegación interior accesible</title>");
    expect(res.text).toContain('<meta name="description" content="Navegación interior accesible">');
    expect(res.text).toMatch(/<style id="tema">[^<]*--color-primary:#1A56DB/);
    expect(res.text).toContain('<link rel="canonical"');

    const claves = datosIniciales(res.text).consultas.map(([k]) => JSON.stringify(k));
    expect(claves).toEqual([
      '["site"]',
      '["pagina","inicio"]',
      '["noticias",{"pagina":1,"porPagina":3}]',
    ]);
  });

  it("los datos iniciales no pueden cerrar el <script> aunque el texto lo intente", async () => {
    const res = await request(app).get("/");
    const bloque = res.text.match(/id="datos-iniciales">(.*?)<\/script>/s)![1]!;
    expect(bloque).not.toContain("</script>");
    expect(bloque).toContain("\\u003c/script>");
    const noticias = datosIniciales(res.text).consultas[2]![1] as { items: { title: string }[] };
    expect(noticias.items[0]!.title).toContain("</script>");
  });

  it.each([
    ["/nosotros", "Nosotros · SIGNAL"],
    ["/noticias", "Noticias · SIGNAL"],
    ["/noticias?pagina=2", "Noticias, página 2 · SIGNAL"],
    ["/contacto", "Contacto · SIGNAL"],
  ])("%s → 200 con su título", async (ruta, titulo) => {
    const res = await request(app).get(ruta);
    expect(res.status).toBe(200);
    expect(res.text).toContain(`<title>${titulo}</title>`);
    expect(res.headers["cache-control"]).toBe("no-cache");
  });

  it("una noticia publicada lleva metadatos de artículo; un borrador es 404", async () => {
    const ok = await request(app).get("/noticias/llega-signal");
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('<meta property="og:type" content="article">');
    expect(ok.text).toContain('<meta name="description" content="Bajada">');
    expect(ok.text).toContain("<title>Llega SIGNAL &lt;/script&gt;");

    const borrador = await request(app).get("/noticias/borrador");
    expect(borrador.status).toBe(404);
    expect(borrador.text).toContain('<meta name="robots" content="noindex">');
  });

  it.each(["/admin", "/login", "/no-existe", "/noticias/un/nivel/de/mas"])(
    "%s → 404 con la página «no encontrada», sin redirigir ni nombrar el panel",
    async (ruta) => {
      const res = await request(app).get(ruta);
      expect(res.status).toBe(404);
      expect(res.headers.location).toBeUndefined();
      expect(res.text).toContain("<title>Página no encontrada · SIGNAL</title>");
      expect(res.text).not.toContain(TEST_ADMIN_PATH);
    },
  );

  it("las rutas de API inexistentes siguen respondiendo JSON", async () => {
    const res = await request(app).get("/api/no-existe");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("robots.txt y sitemap.xml no mencionan el panel y el sitemap solo lista lo publicado", async () => {
    const robots = await request(app).get("/robots.txt");
    expect(robots.text).toMatch(
      /^User-agent: \*\nAllow: \/\n\nSitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml\n$/,
    );

    const sitemap = await request(app).get("/sitemap.xml");
    expect(sitemap.headers["content-type"]).toMatch(/xml/);
    expect(sitemap.text).toContain("/noticias/llega-signal</loc>");
    expect(sitemap.text).not.toContain("borrador");
    for (const texto of [robots.text, sitemap.text]) {
      expect(texto).not.toMatch(/admin|panel/i);
      expect(texto).not.toContain(TEST_ADMIN_PATH);
    }
  });

  it("con SITE_URL usa el dominio público en canonical y sitemap", async () => {
    const conDominio = buildTestApp({ db, env: { SITE_URL: "https://signal.cl" } });
    expect((await request(conDominio).get("/nosotros")).text).toContain(
      '<link rel="canonical" href="https://signal.cl/nosotros">',
    );
    expect((await request(conDominio).get("/sitemap.xml")).text).toContain(
      "<loc>https://signal.cl/</loc>",
    );
  });
});

describe("landing con la base de datos caída", () => {
  const app = buildTestApp();

  it("las páginas conocidas se entregan igual para que el cliente reintente", async () => {
    const res = await request(app).get("/nosotros");
    expect(res.status).toBe(200);
    expect(datosIniciales(res.text).consultas).toEqual([]);
  });

  it("una ruta desconocida sigue siendo 404", async () => {
    expect((await request(app).get("/admin")).status).toBe(404);
  });
});
