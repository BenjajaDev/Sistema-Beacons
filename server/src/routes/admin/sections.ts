import type { Request } from "express";
import { z } from "zod";
import { isSectionKey, SECTION_DEFINITIONS, sectionSchemas } from "../../content/sections.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { Page } from "../../generated/prisma/enums.js";
import { ApiError, forbidden, notFound, parseOrThrow } from "../../http/errors.js";
import { asJson } from "../../lib/json.js";
import type { AdminDeps } from "./deps.js";
import { ADMIN_ONLY, ANY_ROLE, type AdminRoute } from "./registry.js";

// Las secciones tienen contenido publicado (`content`) y un borrador aparte.
// Editores y administradores escriben el borrador; un editor lo envía a revisión
// y solo un administrador lo publica, lo devuelve, cambia la visibilidad o el orden.

const PAGES = ["INICIO", "NOSOTROS", "NOTICIAS", "CONTACTO"] as const satisfies readonly Page[];

const orderSchema = z.object({
  page: z.enum(PAGES),
  keys: z.array(z.string()).min(1),
});
const visibilitySchema = z.object({ visible: z.boolean("Indica si la sección es visible.") });
const rejectSchema = z.object({
  note: z
    .string("Explica qué hay que corregir.")
    .trim()
    .min(1, "Explica qué hay que corregir.")
    .max(1000),
});

export function sectionRoutes({ db, audit }: AdminDeps): AdminRoute[] {
  async function cargar(req: Request) {
    const key = String(req.params.key);
    if (!isSectionKey(key)) throw notFound("La sección");
    const seccion = await db.section.findUnique({
      where: { key },
      include: { draftAuthor: { select: { id: true, name: true } } },
    });
    if (!seccion) throw notFound("La sección");
    return { key, seccion };
  }

  const conNombre = <T extends { key: string }>(s: T) => ({
    ...s,
    nombre: isSectionKey(s.key) ? SECTION_DEFINITIONS[s.key].nombre : s.key,
  });

  async function responder(res: import("express").Response, key: string) {
    const s = await db.section.findUniqueOrThrow({
      where: { key },
      include: { draftAuthor: { select: { id: true, name: true } } },
    });
    res.json({ section: conNombre(s) });
  }

  return [
    {
      roles: ANY_ROLE,
      method: "get",
      path: "/sections",
      handler: async (_req, res) => {
        const filas = await db.section.findMany({
          orderBy: [{ page: "asc" }, { order: "asc" }],
          include: { draftAuthor: { select: { id: true, name: true } } },
        });
        res.json({ items: filas.map(conNombre) });
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "put",
      path: "/sections/order",
      handler: async (req, res) => {
        const { page, keys } = parseOrThrow(orderSchema, req.body);
        const actuales = await db.section.findMany({ where: { page }, select: { key: true } });
        const esperadas = new Set(actuales.map((s) => s.key));
        if (
          keys.length !== esperadas.size ||
          !keys.every((k) => esperadas.has(k)) ||
          new Set(keys).size !== keys.length
        ) {
          throw new ApiError(
            400,
            "VALIDATION",
            "El nuevo orden debe incluir cada sección de la página una sola vez. Recarga y vuelve a intentarlo.",
          );
        }
        await db.$transaction(
          keys.map((key, i) => db.section.update({ where: { key }, data: { order: i + 1 } })),
        );
        await audit(req, { action: "SECTION_REORDER", entity: "Section", meta: { page, keys } });
        res.json({ ok: true });
      },
    },
    {
      roles: ANY_ROLE,
      method: "get",
      path: "/sections/:key",
      handler: async (req, res) => {
        const { seccion } = await cargar(req);
        res.json({ section: conNombre(seccion) });
      },
    },
    {
      roles: ANY_ROLE,
      method: "put",
      path: "/sections/:key/draft",
      handler: async (req, res) => {
        const { key, seccion } = await cargar(req);
        const user = req.user!;
        if (user.role !== "ADMIN" && seccion.draftStatus === "REVIEW") {
          throw new ApiError(
            403,
            "SECTION_LOCKED",
            "Hay cambios de esta sección en revisión. Un administrador debe publicarlos o devolverlos antes de seguir editando.",
          );
        }
        const content = parseOrThrow(sectionSchemas[key], req.body?.content);
        await db.section.update({
          where: { key },
          data: {
            draftContent: asJson(content),
            draftStatus: "DRAFT",
            draftAuthorId: user.id,
            draftUpdatedAt: new Date(),
          },
        });
        await audit(req, { action: "SECTION_DRAFT_SAVE", entity: "Section", entityId: key });
        await responder(res, key);
      },
    },
    {
      roles: ANY_ROLE,
      method: "delete",
      path: "/sections/:key/draft",
      handler: async (req, res) => {
        const { key, seccion } = await cargar(req);
        const user = req.user!;
        if (!seccion.draftStatus)
          throw new ApiError(409, "INVALID_STATE", "Esta sección no tiene cambios pendientes.");
        if (
          user.role !== "ADMIN" &&
          (seccion.draftAuthorId !== user.id || seccion.draftStatus === "REVIEW")
        ) {
          throw forbidden();
        }
        await db.section.update({
          where: { key },
          data: {
            draftContent: Prisma.DbNull,
            draftStatus: null,
            draftAuthorId: null,
            draftUpdatedAt: null,
            reviewNote: null,
          },
        });
        await audit(req, { action: "SECTION_DRAFT_DISCARD", entity: "Section", entityId: key });
        await responder(res, key);
      },
    },
    {
      roles: ANY_ROLE,
      method: "post",
      path: "/sections/:key/submit",
      handler: async (req, res) => {
        const { key, seccion } = await cargar(req);
        if (seccion.draftStatus !== "DRAFT") {
          throw new ApiError(
            409,
            "INVALID_STATE",
            "No hay cambios en borrador para enviar a revisión.",
          );
        }
        if (req.user!.role !== "ADMIN" && seccion.draftAuthorId !== req.user!.id) throw forbidden();
        await db.section.update({
          where: { key },
          data: { draftStatus: "REVIEW", reviewNote: null },
        });
        await audit(req, { action: "SECTION_SUBMIT", entity: "Section", entityId: key });
        await responder(res, key);
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "post",
      path: "/sections/:key/publish",
      handler: async (req, res) => {
        const { key, seccion } = await cargar(req);
        if (!seccion.draftStatus || seccion.draftContent === null) {
          throw new ApiError(409, "INVALID_STATE", "No hay cambios pendientes para publicar.");
        }
        // Se vuelve a validar: el esquema pudo cambiar desde que se guardó el borrador.
        const content = parseOrThrow(sectionSchemas[key], seccion.draftContent);
        await db.section.update({
          where: { key },
          data: {
            content: asJson(content),
            draftContent: Prisma.DbNull,
            draftStatus: null,
            draftAuthorId: null,
            draftUpdatedAt: null,
            reviewNote: null,
            publishedAt: new Date(),
          },
        });
        await audit(req, { action: "SECTION_PUBLISH", entity: "Section", entityId: key });
        await responder(res, key);
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "post",
      path: "/sections/:key/reject",
      handler: async (req, res) => {
        const { key, seccion } = await cargar(req);
        const { note } = parseOrThrow(rejectSchema, req.body);
        if (seccion.draftStatus !== "REVIEW") {
          throw new ApiError(409, "INVALID_STATE", "Esta sección no tiene cambios en revisión.");
        }
        await db.section.update({
          where: { key },
          data: { draftStatus: "DRAFT", reviewNote: note },
        });
        await audit(req, {
          action: "SECTION_REJECT",
          entity: "Section",
          entityId: key,
          meta: { note },
        });
        await responder(res, key);
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "patch",
      path: "/sections/:key/visibility",
      handler: async (req, res) => {
        const { key } = await cargar(req);
        const { visible } = parseOrThrow(visibilitySchema, req.body);
        await db.section.update({ where: { key }, data: { visible } });
        await audit(req, {
          action: visible ? "SECTION_SHOW" : "SECTION_HIDE",
          entity: "Section",
          entityId: key,
        });
        await responder(res, key);
      },
    },
  ];
}
