import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  getCollaborators,
  getNewsBySlug,
  getNewsList,
  getPage,
  getSite,
  getTeam,
  PAGINAS,
} from "../content/public-data.js";
import { ApiError, notFound, parseOrThrow } from "../http/errors.js";
import type { Logger } from "../lib/logger.js";
import type { Db } from "../lib/prisma.js";

// API de solo lectura para la landing. Solo entrega lo publicado: secciones
// visibles, noticias en estado PUBLISHED, miembros y colaboradores visibles.
// Los cambios que se publican en el panel se ven aquí sin redeploy.

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

export function publicApi({ db, logger }: { db: Db; logger: Logger }) {
  const router = Router();

  router.get("/site", cachePublico, async (_req, res) => {
    const site = await getSite(db);
    if (!site) throw new ApiError(503, "NOT_SEEDED", "El sitio todavía no está configurado.");
    res.json(site);
  });

  router.get("/pages/:page", cachePublico, async (req, res) => {
    const page = PAGINAS[String(req.params.page)];
    if (!page) throw notFound("La página");
    res.json(await getPage(db, page));
  });

  router.get("/news", cachePublico, async (req, res) => {
    res.json(await getNewsList(db, parseOrThrow(newsListSchema, req.query)));
  });

  router.get("/news/:slug", cachePublico, async (req, res) => {
    const detalle = await getNewsBySlug(db, String(req.params.slug));
    if (!detalle) throw notFound("La noticia");
    res.json(detalle);
  });

  router.get("/team", cachePublico, async (_req, res) => {
    res.json(await getTeam(db));
  });

  router.get("/collaborators", cachePublico, async (_req, res) => {
    res.json(await getCollaborators(db));
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
