import { randomBytes } from "node:crypto";
import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { CLAVES_MOTIVO } from "../content/contact-reasons.js";
import { CLAVES_TIPO_RECURSO } from "../content/resource-kinds.js";
import {
  getCollaborators,
  getGallery,
  getNewsBySlug,
  getNewsList,
  getPage,
  getResources,
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

// Sin caché a ciegas: el navegador pregunta siempre y, si nada cambió, recibe un 304
// vacío gracias al ETag de Express. Así lo que se guarda en el panel se ve con una
// recarga normal; con max-age, un F5 mostraba la versión anterior.
const cachePublico: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-cache");
  next();
};

const newsListSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
  porPagina: z.coerce.number().int().min(1).max(24).default(9),
  categoria: z.string().trim().max(60).optional(),
});

const resourcesSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
  porPagina: z.coerce.number().int().min(1).max(24).default(12),
  tipo: z.enum(CLAVES_TIPO_RECURSO).optional(),
  q: z.string().trim().max(80).optional(),
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
  // Sin motivo (clientes anteriores) queda como «otro».
  motivo: z.enum(CLAVES_MOTIVO, "Elige el motivo de tu consulta.").default("OTHER"),
  mensaje: z
    .string("Escribe tu mensaje.")
    .trim()
    .min(10, "Cuéntanos un poco más: al menos 10 caracteres.")
    .max(3000, "El mensaje admite hasta 3000 caracteres."),
  // Campo trampa: invisible para las personas, los bots lo rellenan.
  sitioWeb: z.string().optional(),
});

const newsletterSchema = z.object({
  correo: z
    .string("Escribe tu correo.")
    .trim()
    .pipe(z.email("Escribe un correo válido, por ejemplo nombre@dominio.cl.")),
  nombre: z.string().trim().max(120).optional(),
  // El consentimiento tiene que ser expreso: sin la casilla marcada no se suscribe a nadie.
  consentimiento: z.literal(true, "Marca la casilla para aceptar recibir el boletín."),
  // Campo trampa: invisible para las personas, los bots lo rellenan.
  sitioWeb: z.string().optional(),
});
const bajaSchema = z.object({
  token: z.string("Falta el enlace de baja.").trim().min(10).max(100),
});

// Consentimiento que se muestra en el formulario si la sección aún no se editó.
const CONSENTIMIENTO_POR_DEFECTO =
  "Acepto recibir por correo el boletín de SIGNAL. Puedo darme de baja cuando quiera.";

const limitarPorHora = (limite: number, mensaje: string) =>
  rateLimit({
    windowMs: 60 * 60_000,
    limit: limite,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, "RATE_LIMITED", mensaje)),
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

  router.get("/resources", cachePublico, async (req, res) => {
    res.json(await getResources(db, parseOrThrow(resourcesSchema, req.query)));
  });

  router.get("/gallery", cachePublico, async (_req, res) => {
    res.json(await getGallery(db));
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
          reason: d.motivo,
          message: d.mensaje,
        },
      });
      res.status(201).json({ ok: true, mensaje: mensajeExito });
    },
  );

  // --- Boletín ---

  router.post(
    "/newsletter",
    limitarPorHora(
      6,
      "Ya recibimos varias solicitudes desde tu conexión. Intenta de nuevo en una hora o escríbenos desde la página de contacto.",
    ),
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const d = parseOrThrow(newsletterSchema, req.body);
      const seccion = await db.section.findUnique({ where: { key: "boletin" } });
      const contenido = seccion?.content as
        { mensajeExito?: string; textoConsentimiento?: string } | undefined;
      const mensaje = contenido?.mensajeExito ?? "Listo, quedaste suscrita o suscrito al boletín.";

      if (d.sitioWeb) {
        logger.info("Suscripción descartada por el campo trampa");
        res.status(201).json({ ok: true, mensaje });
        return;
      }
      const email = d.correo.trim().toLowerCase();
      // Se guarda el texto que el servidor mostró, no el que mande el navegador.
      const consentText = contenido?.textoConsentimiento ?? CONSENTIMIENTO_POR_DEFECTO;
      const ahora = new Date();
      try {
        const previa = await db.subscriber.findUnique({ where: { email } });
        if (!previa) {
          await db.subscriber.create({
            data: {
              email,
              name: d.nombre || null,
              consentAt: ahora,
              consentText,
              token: randomBytes(24).toString("base64url"),
            },
          });
        } else if (previa.unsubscribedAt) {
          // Volvió a pedir el boletín: es un consentimiento nuevo.
          await db.subscriber.update({
            where: { id: previa.id },
            data: {
              unsubscribedAt: null,
              consentAt: ahora,
              consentText,
              name: d.nombre || previa.name,
            },
          });
        }
      } catch (err) {
        // Dos solicitudes a la vez con el mismo correo: la otra ya lo guardó.
        if ((err as { code?: string }).code !== "P2002") throw err;
      }
      // Responde igual si el correo ya estaba: no revela quién está suscrito.
      res.status(201).json({ ok: true, mensaje });
    },
  );

  router.post(
    "/newsletter/unsubscribe",
    limitarPorHora(30, "Demasiados intentos. Intenta de nuevo en una hora."),
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const { token } = parseOrThrow(bajaSchema, req.body);
      const persona = await db.subscriber.findUnique({ where: { token } });
      if (!persona) throw notFound("El enlace de baja");
      if (!persona.unsubscribedAt) {
        await db.subscriber.update({
          where: { id: persona.id },
          data: { unsubscribedAt: new Date() },
        });
      }
      res.json({ ok: true });
    },
  );

  return router;
}
