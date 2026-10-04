import { readFile } from "node:fs/promises";
import path from "node:path";
import express, { Router, type Request, type Response } from "express";
import {
  getCollaborators,
  getNewsBySlug,
  getNewsList,
  getPage,
  getSite,
  getTeam,
  type PublicSite,
} from "../content/public-data.js";
import type { Logger } from "../lib/logger.js";
import type { Db } from "../lib/prisma.js";

// Sirve la landing (build de index.html) en sus rutas conocidas. Cada página sale
// con su <title>, meta description, Open Graph, el tema de Identidad visual y los
// datos iniciales incluidos, para que el primer render no espere a la API.
//
// Solo las rutas conocidas responden 200. Cualquier otra (incluidas /admin o
// /login) responde 404 con la página «no encontrada», nunca una redirección.

export const POR_PAGINA_NOTICIAS = 9;
export const NOTICIAS_EN_INICIO = 3;

// Par [clave de TanStack Query, datos]: el cliente los carga tal cual en su caché.
type Consulta = [unknown[], unknown];

interface Pagina {
  status: number;
  titulo: string | null;
  descripcion?: string | null;
  imagen?: string | null;
  tipo?: "website" | "article";
  consultas: Consulta[];
}

const RUTAS_FIJAS = new Set(["/", "/nosotros", "/noticias", "/contacto"]);
const RUTA_NOTICIA = /^\/noticias\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Si la ruta es de la landing. No depende de la base de datos: una ruta
// desconocida es 404 aunque la base no responda.
function rutaConocida(ruta: string) {
  return RUTAS_FIJAS.has(ruta) || RUTA_NOTICIA.test(ruta);
}

function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// JSON dentro de <script>: escapar «<» evita que un texto con «</script>» cierre el bloque.
function jsonSeguro(datos: unknown) {
  return JSON.stringify(datos).replaceAll("<", "\\u003c");
}

export function landing(deps: {
  db: Db;
  logger: Logger;
  distDir: string;
  siteUrl?: string;
  cacheHtml: boolean;
  getThemeCss: () => Promise<string | null>;
}) {
  const { db, logger, distDir } = deps;
  const router = Router({ caseSensitive: true });
  let plantilla: string | null = null;

  const origen = (req: Request) =>
    (deps.siteUrl ?? `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");

  async function leerPlantilla() {
    if (plantilla && deps.cacheHtml) return plantilla;
    plantilla = await readFile(path.join(distDir, "index.html"), "utf-8");
    return plantilla;
  }

  async function datosDe(req: Request): Promise<Pagina> {
    const ruta = req.path.replace(/\/$/, "") || "/";
    const sitio = await getSite(db);
    const base: Consulta[] = sitio ? [[["site"], sitio]] : [];
    if (!rutaConocida(ruta))
      return { status: 404, titulo: "Página no encontrada", consultas: base };

    if (ruta === "/") {
      const inicio = await getPage(db, "INICIO");
      const consultas: Consulta[] = [...base, [["pagina", "inicio"], inicio]];
      // La sección «Nosotros» del inicio muestra las fotos del equipo.
      if (inicio.secciones.some((s) => s.key === "nosotros-inicio")) {
        consultas.push([["equipo"], await getTeam(db)]);
      }
      if (inicio.secciones.some((s) => s.key === "noticias-recientes")) {
        const q = { pagina: 1, porPagina: NOTICIAS_EN_INICIO };
        consultas.push([["noticias", q], await getNewsList(db, q)]);
      }
      return { status: 200, titulo: null, descripcion: sitio?.tagline, consultas };
    }
    if (ruta === "/nosotros") {
      return {
        status: 200,
        titulo: "Nosotros",
        consultas: [
          ...base,
          [["pagina", "nosotros"], await getPage(db, "NOSOTROS")],
          [["equipo"], await getTeam(db)],
          [["colaboradores"], await getCollaborators(db)],
        ],
      };
    }
    if (ruta === "/noticias") {
      const pagina = Math.max(1, Math.min(1000, Number(req.query.pagina) || 1));
      const q = { pagina, porPagina: POR_PAGINA_NOTICIAS };
      return {
        status: 200,
        titulo: pagina > 1 ? `Noticias, página ${pagina}` : "Noticias",
        consultas: [
          ...base,
          [["pagina", "noticias"], await getPage(db, "NOTICIAS")],
          [["noticias", q], await getNewsList(db, q)],
        ],
      };
    }
    const slug = ruta.match(/^\/noticias\/([^/]+)$/)?.[1];
    if (slug) {
      const detalle = await getNewsBySlug(db, slug);
      if (!detalle) return { status: 404, titulo: "Página no encontrada", consultas: base };
      return {
        status: 200,
        titulo: detalle.news.title,
        descripcion: detalle.news.excerpt,
        imagen: detalle.news.cover?.url,
        tipo: "article",
        consultas: [...base, [["noticia", slug], detalle]],
      };
    }
    if (ruta === "/contacto") {
      return {
        status: 200,
        titulo: "Contacto",
        consultas: [...base, [["pagina", "contacto"], await getPage(db, "CONTACTO")]],
      };
    }
    return { status: 404, titulo: "Página no encontrada", consultas: base };
  }

  function cabecera(req: Request, p: Pagina, sitio: PublicSite | undefined, tema: string | null) {
    const nombre = sitio?.siteName ?? "SIGNAL";
    const titulo = p.titulo
      ? `${p.titulo} · ${nombre}`
      : sitio?.tagline
        ? `${nombre} · ${sitio.tagline}`
        : nombre;
    const url = `${origen(req)}${req.path}`;
    const etiquetas = [
      p.descripcion && `<meta property="og:description" content="${escaparHtml(p.descripcion)}">`,
      `<meta property="og:title" content="${escaparHtml(titulo)}">`,
      `<meta property="og:type" content="${p.tipo ?? "website"}">`,
      `<meta property="og:site_name" content="${escaparHtml(nombre)}">`,
      `<meta property="og:locale" content="es_CL">`,
      p.status === 200 && `<meta property="og:url" content="${escaparHtml(url)}">`,
      p.status === 200 && `<link rel="canonical" href="${escaparHtml(url)}">`,
      p.imagen &&
        `<meta property="og:image" content="${escaparHtml(p.imagen.startsWith("http") ? p.imagen : origen(req) + p.imagen)}">`,
      p.status !== 200 && `<meta name="robots" content="noindex">`,
      sitio?.favicon && `<link rel="icon" href="${escaparHtml(sitio.favicon)}">`,
      tema && `<style id="tema">${tema}</style>`,
      `<script type="application/json" id="datos-iniciales">${jsonSeguro({ consultas: p.consultas })}</script>`,
    ];
    return { titulo, html: etiquetas.filter(Boolean).join("") };
  }

  async function servir(req: Request, res: Response) {
    let html: string;
    try {
      html = await leerPlantilla();
    } catch {
      res
        .status(503)
        .type("text/plain; charset=utf-8")
        .send("La landing no está compilada. Ejecuta `npm run build` y reinicia el servidor.");
      return;
    }

    let pagina: Pagina;
    try {
      pagina = await datosDe(req);
    } catch (err) {
      // Sin base de datos se entrega igual la página: el cliente intentará cargar
      // los datos y, si no puede, muestra un mensaje de error con reintento.
      logger.error({ err, ruta: req.path }, "No se pudieron cargar los datos iniciales");
      const ruta = req.path.replace(/\/$/, "") || "/";
      pagina = rutaConocida(ruta)
        ? { status: 200, titulo: null, consultas: [] }
        : { status: 404, titulo: "Página no encontrada", consultas: [] };
    }
    const sitio = pagina.consultas.find(([k]) => k[0] === "site")?.[1] as PublicSite | undefined;
    const { titulo, html: extra } = cabecera(req, pagina, sitio, await deps.getThemeCss());

    let salida = html.replace(/<title>[^<]*<\/title>/, `<title>${escaparHtml(titulo)}</title>`);
    if (pagina.descripcion) {
      salida = salida.replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
        `<meta name="description" content="${escaparHtml(pagina.descripcion)}">`,
      );
    }
    salida = salida.replace("</head>", `${extra}</head>`);
    res.status(pagina.status).setHeader("Cache-Control", "no-cache").type("html").send(salida);
  }

  // --- robots.txt y sitemap.xml (sin ninguna mención al panel) ---

  router.get("/robots.txt", (req, res) => {
    res
      .type("text/plain; charset=utf-8")
      .send(`User-agent: *\nAllow: /\n\nSitemap: ${origen(req)}/sitemap.xml\n`);
  });

  router.get("/sitemap.xml", async (req, res) => {
    const base = origen(req);
    const noticias = await db.news.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, updatedAt: true },
    });
    const urls = [
      ...["/", "/nosotros", "/noticias", "/contacto"].map(
        (p) => `<url><loc>${base}${p}</loc></url>`,
      ),
      ...noticias.map(
        (n) =>
          `<url><loc>${base}/noticias/${n.slug}</loc><lastmod>${n.updatedAt.toISOString()}</lastmod></url>`,
      ),
    ];
    res
      .type("application/xml")
      .setHeader("Cache-Control", "public, max-age=3600")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>\n`,
      );
  });

  // --- Archivos estáticos del build ---

  router.use(
    express.static(distDir, {
      index: false,
      setHeaders: (res, archivo) => {
        const nombre = path.basename(archivo);
        if (archivo.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (
          /^(sw\.js|registerSW\.js|workbox-.*\.js|manifest\.webmanifest|theme-init\.js)$/.test(
            nombre,
          )
        ) {
          // El service worker y el manifest deben revisarse siempre para que las
          // actualizaciones lleguen.
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  // --- Páginas ---

  router.get(["/", "/nosotros", "/noticias", "/noticias/:slug", "/contacto"], servir);

  // Cualquier otra página: 404 con la vista «no encontrada». Las rutas de API,
  // de la app y las de archivos (con extensión) siguen con su 404 en JSON.
  router.get(/^\/(?!api\/|beacons\/|uploads\/)[^.]*$/, (req, res, next) => {
    if (!req.accepts("html")) return next();
    return servir(req, res);
  });

  return router;
}
