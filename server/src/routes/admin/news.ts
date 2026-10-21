import type { Request } from "express";
import { z } from "zod";
import type { SessionUser } from "../../auth/session.js";
import { PUBLIC_NEWS_INCLUDE, toNewsDetail } from "../../content/news-view.js";
import {
  checkAccessibility,
  docSchema,
  EMPTY_DOC,
  readingStats,
  renderDoc,
  type Doc,
} from "../../content/rich-text.js";
import type { News, Prisma } from "../../generated/prisma/client.js";
import { ApiError, forbidden, notFound, parseOrThrow } from "../../http/errors.js";
import { asJson } from "../../lib/json.js";
import { SLUG_REGEX, slugify, uniqueSlug } from "../../lib/slug.js";
import type { AdminDeps } from "./deps.js";
import { changedFields, idParam, page, paginationSchema } from "./helpers.js";
import { ADMIN_ONLY, ANY_ROLE, type AdminRoute } from "./registry.js";

// Flujo editorial:
//   DRAFT ──submit──▶ REVIEW ──publish──▶ PUBLISHED
//     ▲                  │ reject               │ unpublish
//     └──────────────────┴──────────────────────┘
// Un editor crea notas y edita las suyas mientras están en borrador; solo un
// administrador publica, devuelve con observaciones o despublica.

const campos = {
  title: z
    .string("Escribe un título.")
    .trim()
    .min(1, "Escribe un título.")
    .max(160, "Máximo 160 caracteres."),
  excerpt: z.string().trim().max(300, "La bajada admite hasta 300 caracteres."),
  category: z.string().trim().max(60, "Máximo 60 caracteres."),
  bodyJson: docSchema,
  coverId: z.uuid("Imagen no válida.").nullable(),
  coverAlt: z.string().trim().max(300, "Máximo 300 caracteres.").nullable(),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(SLUG_REGEX, "Usa solo minúsculas, números y guiones, por ejemplo «nueva-sede»."),
};

const createSchema = z.object({
  title: campos.title,
  excerpt: campos.excerpt.default(""),
  category: campos.category.default(""),
  bodyJson: campos.bodyJson.default(EMPTY_DOC),
  coverId: campos.coverId.optional(),
  coverAlt: campos.coverAlt.optional(),
  slug: campos.slug.optional(),
});

const updateSchema = z.object(campos).partial();

const listSchema = paginationSchema.extend({
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED"]).optional(),
  mias: z.enum(["true", "false"]).optional(),
  q: z.string().trim().max(100).optional(),
});

const rejectSchema = z.object({
  note: z
    .string("Explica qué hay que corregir.")
    .trim()
    .min(1, "Explica qué hay que corregir.")
    .max(1000),
});

const ADMIN_INCLUDE = {
  author: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
  cover: { select: { id: true, url: true, width: true, height: true } },
} satisfies Prisma.NewsInclude;

function vista(n: Prisma.NewsGetPayload<{ include: typeof ADMIN_INCLUDE }>) {
  const doc = docSchema.safeParse(n.bodyJson);
  return {
    ...n,
    accesibilidad: doc.success ? checkAccessibility(doc.data) : null,
    lectura: doc.success ? readingStats(doc.data) : null,
  };
}

function assertCanEdit(user: SessionUser, news: News) {
  if (user.role === "ADMIN") return;
  if (news.authorId !== user.id) {
    throw new ApiError(403, "NEWS_LOCKED", "Solo puedes editar las notas que escribiste.");
  }
  if (news.status === "REVIEW") {
    throw new ApiError(
      403,
      "NEWS_LOCKED",
      "Esta nota está en revisión. Un administrador debe publicarla o devolverla antes de poder editarla.",
    );
  }
  if (news.status === "PUBLISHED") {
    throw new ApiError(
      403,
      "NEWS_LOCKED",
      "Esta nota ya está publicada. Pide a un administrador que la despublique para editarla.",
    );
  }
}

// Lo que debe cumplir una nota para ir a revisión o publicarse.
function assertReady(news: News) {
  const faltan: Record<string, string> = {};
  if (!news.title.trim()) faltan.title = "Escribe un título.";
  if (!news.excerpt.trim())
    faltan.excerpt = "Escribe la bajada: se muestra en las tarjetas y al compartir.";
  if (!news.category.trim()) faltan.category = "Elige una categoría.";
  if (news.coverId && !news.coverAlt?.trim()) {
    faltan.coverAlt = "Describe la imagen de portada (texto alternativo).";
  }
  const doc = docSchema.safeParse(news.bodyJson);
  const accesibilidad = doc.success
    ? checkAccessibility(doc.data)
    : {
        errores: [{ code: "CUERPO_INVALIDO", message: "El cuerpo no es válido." }],
        advertencias: [],
      };

  if (Object.keys(faltan).length || accesibilidad.errores.length) {
    throw new ApiError(
      422,
      "NOT_READY",
      "La nota aún no se puede enviar: completa los campos marcados y corrige los problemas de accesibilidad.",
      { campos: faltan, accesibilidad },
    );
  }
  return accesibilidad;
}

export function newsRoutes({ db, audit }: AdminDeps): AdminRoute[] {
  async function cargar(req: Request) {
    const id = idParam(req, "La noticia");
    const news = await db.news.findUnique({ where: { id } });
    if (!news) throw notFound("La noticia");
    return news;
  }

  async function validarPortada(
    coverId: string | null | undefined,
    coverAlt: string | null | undefined,
  ) {
    if (!coverId) return;
    if (!coverAlt?.trim()) {
      throw new ApiError(400, "VALIDATION", "Revisa los campos marcados.", {
        campos: {
          coverAlt: "Describe la imagen de portada: es obligatorio para publicar una imagen.",
        },
      });
    }
    if (!(await db.media.findUnique({ where: { id: coverId }, select: { id: true } }))) {
      throw new ApiError(400, "VALIDATION", "Revisa los campos marcados.", {
        campos: { coverId: "La imagen elegida ya no existe. Sube otra." },
      });
    }
  }

  const slugLibre = (excepto?: string) => async (slug: string) =>
    Boolean(
      await db.news.findFirst({ where: { slug, id: { not: excepto } }, select: { id: true } }),
    );

  async function asegurarSlug(slug: string, excepto?: string) {
    if (await slugLibre(excepto)(slug)) {
      throw new ApiError(409, "VALIDATION", "Revisa los campos marcados.", {
        campos: { slug: "Ya hay otra nota con esta dirección. Elige otra." },
      });
    }
  }

  async function responder(res: import("express").Response, id: string, status = 200) {
    const n = await db.news.findUniqueOrThrow({ where: { id }, include: ADMIN_INCLUDE });
    res.status(status).json({ news: vista(n) });
  }

  return [
    {
      roles: ANY_ROLE,
      method: "get",
      path: "/news/categories",
      handler: async (_req, res) => {
        const filas = await db.news.findMany({
          where: { category: { not: "" } },
          distinct: ["category"],
          select: { category: true },
          orderBy: { category: "asc" },
        });
        res.json({ categorias: filas.map((f) => f.category) });
      },
    },
    {
      roles: ANY_ROLE,
      method: "get",
      path: "/news",
      handler: async (req, res) => {
        const q = parseOrThrow(listSchema, req.query);
        const filas = await db.news.findMany({
          where: {
            status: q.status,
            authorId: q.mias === "true" ? req.user!.id : undefined,
            title: q.q ? { contains: q.q, mode: "insensitive" } : undefined,
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: q.limit + 1,
          ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
          omit: { bodyJson: true, bodyHtml: true },
          include: ADMIN_INCLUDE,
        });
        const conteo = await db.news.groupBy({ by: ["status"], _count: true });
        res.json({
          ...page(filas, q.limit),
          porEstado: Object.fromEntries(conteo.map((c) => [c.status, c._count])),
        });
      },
    },
    {
      roles: ANY_ROLE,
      method: "get",
      path: "/news/:id",
      handler: async (req, res) => {
        const id = idParam(req, "La noticia");
        const n = await db.news.findUnique({ where: { id }, include: ADMIN_INCLUDE });
        if (!n) throw notFound("La noticia");
        res.json({ news: vista(n) });
      },
    },
    {
      // Vista previa: el borrador con la misma forma que recibe la landing.
      roles: ANY_ROLE,
      method: "get",
      path: "/news/:id/preview",
      handler: async (req, res) => {
        const id = idParam(req, "La noticia");
        const n = await db.news.findUnique({ where: { id }, include: PUBLIC_NEWS_INCLUDE });
        if (!n) throw notFound("La noticia");
        res.json({ news: toNewsDetail(n), status: n.status });
      },
    },
    {
      roles: ANY_ROLE,
      method: "post",
      path: "/news",
      handler: async (req, res) => {
        const d = parseOrThrow(createSchema, req.body);
        await validarPortada(d.coverId, d.coverAlt);
        let slug: string;
        if (d.slug) {
          await asegurarSlug(d.slug);
          slug = d.slug;
        } else {
          slug = await uniqueSlug(slugify(d.title), slugLibre());
        }
        const news = await db.news.create({
          data: {
            title: d.title,
            slug,
            excerpt: d.excerpt,
            category: d.category,
            bodyJson: asJson(d.bodyJson),
            bodyHtml: renderDoc(d.bodyJson),
            coverId: d.coverId ?? null,
            coverAlt: d.coverId ? (d.coverAlt ?? null) : null,
            authorId: req.user!.id,
          },
        });
        await audit(req, { action: "NEWS_CREATE", entity: "News", entityId: news.id });
        await responder(res, news.id, 201);
      },
    },
    {
      roles: ANY_ROLE,
      method: "patch",
      path: "/news/:id",
      handler: async (req, res) => {
        const news = await cargar(req);
        assertCanEdit(req.user!, news);
        const d = parseOrThrow(updateSchema, req.body);

        const coverId = d.coverId !== undefined ? d.coverId : news.coverId;
        const coverAlt = d.coverAlt !== undefined ? d.coverAlt : news.coverAlt;
        await validarPortada(coverId, coverAlt);

        if (d.slug !== undefined && d.slug !== news.slug) {
          if (news.publishedAt) {
            throw new ApiError(400, "VALIDATION", "Revisa los campos marcados.", {
              campos: {
                slug: "La dirección no se puede cambiar después de publicar: rompería los enlaces compartidos.",
              },
            });
          }
          await asegurarSlug(d.slug, news.id);
        }

        const data: Prisma.NewsUpdateInput = {
          title: d.title,
          slug: d.slug,
          excerpt: d.excerpt,
          category: d.category,
          coverAlt: coverId ? coverAlt : null,
          cover:
            d.coverId === undefined
              ? undefined
              : d.coverId
                ? { connect: { id: d.coverId } }
                : { disconnect: true },
        };
        if (d.bodyJson) {
          data.bodyJson = asJson(d.bodyJson);
          data.bodyHtml = renderDoc(d.bodyJson as Doc);
        }
        await db.news.update({ where: { id: news.id }, data });
        await audit(req, {
          action: "NEWS_UPDATE",
          entity: "News",
          entityId: news.id,
          meta: { campos: changedFields(news, d) },
        });
        await responder(res, news.id);
      },
    },
    {
      roles: ANY_ROLE,
      method: "post",
      path: "/news/:id/submit",
      handler: async (req, res) => {
        const news = await cargar(req);
        assertCanEdit(req.user!, news);
        if (news.status !== "DRAFT") {
          throw new ApiError(
            409,
            "INVALID_STATE",
            "Solo se pueden enviar a revisión las notas en borrador.",
          );
        }
        assertReady(news);
        await db.news.update({
          where: { id: news.id },
          data: { status: "REVIEW", submittedAt: new Date(), reviewNote: null },
        });
        await audit(req, { action: "NEWS_SUBMIT", entity: "News", entityId: news.id });
        await responder(res, news.id);
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "post",
      path: "/news/:id/publish",
      handler: async (req, res) => {
        const news = await cargar(req);
        if (news.status === "PUBLISHED") {
          throw new ApiError(409, "INVALID_STATE", "La nota ya está publicada.");
        }
        assertReady(news);
        await db.news.update({
          where: { id: news.id },
          data: {
            status: "PUBLISHED",
            publishedAt: news.publishedAt ?? new Date(),
            reviewerId: req.user!.id,
            reviewNote: null,
          },
        });
        await audit(req, { action: "NEWS_PUBLISH", entity: "News", entityId: news.id });
        await responder(res, news.id);
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "post",
      path: "/news/:id/reject",
      handler: async (req, res) => {
        const news = await cargar(req);
        const { note } = parseOrThrow(rejectSchema, req.body);
        if (news.status !== "REVIEW") {
          throw new ApiError(
            409,
            "INVALID_STATE",
            "Solo se pueden devolver notas que están en revisión.",
          );
        }
        await db.news.update({
          where: { id: news.id },
          data: { status: "DRAFT", reviewNote: note, reviewerId: req.user!.id },
        });
        await audit(req, {
          action: "NEWS_REJECT",
          entity: "News",
          entityId: news.id,
          meta: { note },
        });
        await responder(res, news.id);
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "post",
      path: "/news/:id/unpublish",
      handler: async (req, res) => {
        const news = await cargar(req);
        if (news.status !== "PUBLISHED") {
          throw new ApiError(409, "INVALID_STATE", "La nota no está publicada.");
        }
        await db.news.update({ where: { id: news.id }, data: { status: "DRAFT" } });
        await audit(req, { action: "NEWS_UNPUBLISH", entity: "News", entityId: news.id });
        await responder(res, news.id);
      },
    },
    {
      // Un editor puede borrar sus borradores que nunca se publicaron; el admin, cualquier nota.
      roles: ANY_ROLE,
      method: "delete",
      path: "/news/:id",
      handler: async (req, res) => {
        const news = await cargar(req);
        const user = req.user!;
        if (
          user.role !== "ADMIN" &&
          (news.authorId !== user.id || news.status !== "DRAFT" || news.publishedAt)
        ) {
          throw forbidden();
        }
        await db.news.delete({ where: { id: news.id } });
        await audit(req, {
          action: "NEWS_DELETE",
          entity: "News",
          entityId: news.id,
          meta: { title: news.title },
        });
        res.status(204).end();
      },
    },
  ];
}
