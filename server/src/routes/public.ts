import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { PUBLIC_NEWS_INCLUDE, toNewsCard, toNewsDetail } from "../content/news-view.js";
import { FONT_OPTIONS, type Fonts } from "../content/theme.js";
import type { Page } from "../generated/prisma/enums.js";
import { ApiError, notFound, parseOrThrow } from "../http/errors.js";
import type { Logger } from "../lib/logger.js";
import type { Db } from "../lib/prisma.js";
import { SLUG_REGEX } from "../lib/slug.js";

// API de solo lectura para la landing. Solo entrega lo publicado: secciones
// visibles, noticias en estado PUBLISHED, miembros y colaboradores visibles.
// Los cambios que se publican en el panel se ven aquí sin redeploy.

const PAGINAS: Record<string, Page> = {
  inicio: "INICIO",
  nosotros: "NOSOTROS",
  noticias: "NOTICIAS",
  contacto: "CONTACTO",
};

// Caché corta: un cambio publicado tarda como máximo un minuto en verse.
const cachePublico: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=600");
  next();
};

const newsListSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
  porPagina: z.coerce.number().int().min(1).max(24).default(9),
  categoria: z.string().trim().max(60).optional(),
});

const contactSchema = z.object({
  nombre: z.string("Escribe tu nombre.").trim().min(1, "Escribe tu nombre.").max(120),
  correo: z.email("Escribe un correo válido, por ejemplo nombre@dominio.cl."),
  telefono: z
    .string()
    .trim()
    .max(25)
    .regex(/^[+\d\s()-]*$/, "Escribe solo números, espacios y los signos + ( ) -.")
    .optional(),
  asunto: z.string().trim().max(150).optional(),
  mensaje: z
    .string("Escribe tu mensaje.")
    .trim()
    .min(10, "Cuéntanos un poco más: al menos 10 caracteres.")
    .max(3000, "El mensaje admite hasta 3000 caracteres."),
  // Campo trampa: invisible para las personas, los bots lo rellenan.
  sitioWeb: z.string().optional(),
});

// El JSON del editor no hace falta en la landing: de los textos enriquecidos solo
// se envía el HTML ya saneado.
function soloHtml(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(soloHtml);
  if (valor && typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    if ("json" in obj && typeof obj.html === "string") return { html: obj.html };
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, soloHtml(v)]));
  }
  return valor;
}

const IMAGEN = { select: { url: true, width: true, height: true } } as const;

export function publicApi({ db, logger }: { db: Db; logger: Logger }) {
  const router = Router();

  router.get("/site", cachePublico, async (_req, res) => {
    const s = await db.siteSettings.findUnique({
      where: { id: 1 },
      include: { logoLight: IMAGEN, logoDark: IMAGEN, favicon: IMAGEN },
    });
    if (!s) throw new ApiError(503, "NOT_SEEDED", "El sitio todavía no está configurado.");
    const fuentes = s.fonts as Fonts;
    res.json({
      siteName: s.siteName,
      tagline: s.tagline,
      logos: {
        claro: s.logoLight ? { ...s.logoLight, alt: s.logoLightAlt ?? s.siteName } : null,
        oscuro: s.logoDark ? { ...s.logoDark, alt: s.logoDarkAlt ?? s.siteName } : null,
      },
      favicon: s.favicon?.url ?? null,
      palette: s.palette,
      fonts: {
        cuerpo: { id: fuentes.cuerpo, ...FONT_OPTIONS[fuentes.cuerpo] },
        titulos: { id: fuentes.titulos, ...FONT_OPTIONS[fuentes.titulos] },
      },
      contacto: {
        telefono: s.contactPhone,
        correo: s.contactEmail,
        direccion: s.contactAddress,
        redes: s.socials,
      },
      accesibilidad: s.accessibilityStatement,
    });
  });

  router.get("/pages/:page", cachePublico, async (req, res) => {
    const page = PAGINAS[String(req.params.page)];
    if (!page) throw notFound("La página");
    const secciones = await db.section.findMany({
      where: { page, visible: true },
      orderBy: { order: "asc" },
      select: { key: true, content: true },
    });
    res.json({ secciones: secciones.map((s) => ({ key: s.key, content: soloHtml(s.content) })) });
  });

  router.get("/news", cachePublico, async (req, res) => {
    const q = parseOrThrow(newsListSchema, req.query);
    const where = { status: "PUBLISHED" as const, category: q.categoria || undefined };
    const [total, filas] = await Promise.all([
      db.news.count({ where }),
      db.news.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: (q.pagina - 1) * q.porPagina,
        take: q.porPagina,
        include: PUBLIC_NEWS_INCLUDE,
      }),
    ]);
    res.json({
      items: filas.map(toNewsCard),
      pagina: q.pagina,
      porPagina: q.porPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / q.porPagina)),
    });
  });

  router.get("/news/:slug", cachePublico, async (req, res) => {
    const slug = String(req.params.slug);
    if (!SLUG_REGEX.test(slug)) throw notFound("La noticia");
    const n = await db.news.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: PUBLIC_NEWS_INCLUDE,
    });
    if (!n) throw notFound("La noticia");
    res.json({ news: toNewsDetail(n) });
  });

  router.get("/team", cachePublico, async (_req, res) => {
    const filas = await db.teamMember.findMany({
      where: { visible: true },
      orderBy: { order: "asc" },
      include: { photo: IMAGEN },
    });
    res.json({
      items: filas.map((m) => ({
        name: m.name,
        position: m.position,
        bio: m.bio,
        links: m.links,
        photo: m.photo ? { ...m.photo, alt: m.photoAlt ?? "" } : null,
      })),
    });
  });

  router.get("/collaborators", cachePublico, async (_req, res) => {
    const filas = await db.collaborator.findMany({
      where: { visible: true },
      orderBy: { order: "asc" },
      include: { logo: IMAGEN },
    });
    res.json({
      items: filas.map((c) => ({
        name: c.name,
        description: c.description,
        url: c.url,
        logo: c.logo ? { ...c.logo, alt: c.logoAlt ?? c.name } : null,
      })),
    });
  });

  router.post(
    "/contact",
    rateLimit({
      windowMs: 60 * 60_000,
      limit: 5,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(
          new ApiError(
            429,
            "RATE_LIMITED",
            "Ya recibimos varios mensajes desde tu conexión. Intenta de nuevo en una hora o escríbenos por correo.",
          ),
        ),
    }),
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const d = parseOrThrow(contactSchema, req.body);
      const seccion = await db.section.findUnique({ where: { key: "contacto" } });
      const mensajeExito =
        (seccion?.content as { mensajeExito?: string } | undefined)?.mensajeExito ??
        "Recibimos tu mensaje.";

      // A un bot se le responde igual que a una persona, para no darle pistas.
      if (d.sitioWeb) {
        logger.info("Mensaje de contacto descartado por el campo trampa");
        res.status(201).json({ ok: true, mensaje: mensajeExito });
        return;
      }
      await db.contactMessage.create({
        data: {
          name: d.nombre,
          email: d.correo,
          phone: d.telefono || null,
          subject: d.asunto || null,
          message: d.mensaje,
        },
      });
      res.status(201).json({ ok: true, mensaje: mensajeExito });
    },
  );

  return router;
}
