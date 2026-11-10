import { randomUUID } from "node:crypto";
import multer from "multer";
import { z } from "zod";
import { CLAVES_TIPO_RECURSO } from "../../content/resource-kinds.js";
import { ApiError, notFound, parseOrThrow } from "../../http/errors.js";
import type { AdminDeps } from "./deps.js";
import { changedFields, idParam, textoOpcional, urlHttps } from "./helpers.js";
import { CONTENT_ROLES, type AdminRoute } from "./registry.js";

// Repositorio de recursos abiertos. Cada recurso lleva un PDF subido al sitio, un DOI
// o un enlace a un repositorio institucional (al menos uno de los tres). Son
// contenido: lo editan ADMIN y EDITOR, igual que el equipo.

const DOI = /^10\.\d{4,9}\/\S+$/;

// Acepta el DOI suelto o como enlace de doi.org, y guarda solo el DOI.
const doi = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((v) => (v ? v.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "") : null))
  .refine(
    (v) => v === null || DOI.test(v),
    "Escribe un DOI válido, por ejemplo 10.1234/abcd.5678 (también sirve el enlace de doi.org).",
  );

const fecha = z
  .union([z.iso.date("Escribe una fecha válida."), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : v === undefined ? undefined : null));

// Ojo: en Zod 4, .partial() aplica los .default(). El esquema base no tiene defaults
// (sirve para editar) y el de creación los agrega.
const base = z.object({
  title: z.string("Escribe el título.").trim().min(1, "Escribe el título.").max(200),
  description: textoOpcional(600),
  kind: z.enum(CLAVES_TIPO_RECURSO, "Elige el tipo de recurso."),
  authors: textoOpcional(200),
  publishedOn: fecha,
  doi,
  externalUrl: urlHttps.nullish().transform((v) => v ?? null),
  license: textoOpcional(80),
  fileId: z
    .uuid("Archivo no válido.")
    .nullish()
    .transform((v) => v ?? null),
  visible: z.boolean(),
});
const crear = base.extend({
  kind: base.shape.kind.default("OTHER"),
  visible: z.boolean().default(true),
});

const include = { file: { select: { id: true, url: true, sizeBytes: true, originalName: true } } };

export function resourceRoutes({ db, env, audit, storage, logger }: AdminDeps): AdminRoute[] {
  const subida = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.floor(env.DOCUMENT_MAX_MB * 1024 * 1024), files: 1, fields: 2 },
  }).single("archivo");

  // El PDF ya no se usa: se borra su registro y el archivo (si falla, queda huérfano
  // sin afectar al sitio).
  async function soltarDocumento(mediaId: string | null | undefined) {
    if (!mediaId) return;
    if ((await db.resource.count({ where: { fileId: mediaId } })) > 0) return;
    const media = await db.media.delete({ where: { id: mediaId } }).catch(() => null);
    if (!media) return;
    try {
      await storage.remove(media.storageKey);
    } catch (err) {
      logger.warn({ err, key: media.storageKey }, "No se pudo borrar el documento");
    }
  }

  async function validarAcceso(final: {
    fileId: string | null;
    doi: string | null;
    externalUrl: string | null;
  }) {
    if (final.fileId) {
      const media = await db.media.findUnique({ where: { id: final.fileId } });
      if (!media || media.mimeType !== "application/pdf") {
        throw new ApiError(400, "VALIDATION", "Revisa los campos marcados.", {
          campos: { fileId: "El archivo elegido ya no existe. Sube el PDF de nuevo." },
        });
      }
    }
    if (!final.fileId && !final.doi && !final.externalUrl) {
      throw new ApiError(400, "VALIDATION", "Revisa los campos marcados.", {
        campos: {
          fileId: "Sube un PDF o, si el documento está en otro lugar, escribe su DOI o su enlace.",
        },
      });
    }
  }

  return [
    {
      roles: CONTENT_ROLES,
      method: "post",
      path: "/documents",
      handler: [
        subida,
        async (req, res) => {
          if (!req.file) {
            throw new ApiError(400, "VALIDATION", "Elige un PDF para subir.", {
              campos: { archivo: "Elige un PDF para subir." },
            });
          }
          // Se comprueba el contenido y no solo el nombre o el tipo que declara el
          // navegador: todo PDF empieza con «%PDF-».
          if (req.file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
            throw new ApiError(400, "VALIDATION", "Solo se aceptan archivos PDF.", {
              campos: { archivo: "Solo se aceptan archivos PDF." },
            });
          }
          const key = `documentos/${randomUUID()}.pdf`;
          const { url } = await storage.put(key, req.file.buffer, "application/pdf");
          const media = await db.media.create({
            data: {
              storageKey: key,
              url,
              mimeType: "application/pdf",
              sizeBytes: req.file.buffer.length,
              originalName: req.file.originalname.slice(0, 200),
              uploadedById: req.user!.id,
            },
            select: { id: true, url: true, sizeBytes: true, originalName: true },
          });
          await audit(req, { action: "DOCUMENT_UPLOAD", entity: "Media", entityId: media.id });
          res.status(201).json({ media });
        },
      ],
    },
    {
      roles: CONTENT_ROLES,
      method: "get",
      path: "/resources",
      handler: async (_req, res) => {
        const filas = await db.resource.findMany({
          orderBy: [
            { publishedOn: { sort: "desc", nulls: "last" } },
            { createdAt: "desc" },
            { id: "desc" },
          ],
          include,
        });
        // El panel reutiliza la lista de colecciones, que muestra `name`.
        res.json({ items: filas.map((r) => ({ ...r, name: r.title })) });
      },
    },
    {
      roles: CONTENT_ROLES,
      method: "post",
      path: "/resources",
      handler: async (req, res) => {
        const d = parseOrThrow(crear, req.body);
        await validarAcceso(d);
        const creado = await db.resource.create({
          data: { ...d, publishedOn: d.publishedOn ?? null },
          include,
        });
        await audit(req, { action: "RESOURCE_CREATE", entity: "Resource", entityId: creado.id });
        res.status(201).json({ item: { ...creado, name: creado.title } });
      },
    },
    {
      roles: CONTENT_ROLES,
      method: "patch",
      path: "/resources/:id",
      handler: async (req, res) => {
        const id = idParam(req, "El recurso");
        const antes = await db.resource.findUnique({ where: { id } });
        if (!antes) throw notFound("El recurso");
        const d = parseOrThrow(base.partial(), req.body);
        await validarAcceso({
          fileId: d.fileId !== undefined ? d.fileId : antes.fileId,
          doi: d.doi !== undefined ? d.doi : antes.doi,
          externalUrl: d.externalUrl !== undefined ? d.externalUrl : antes.externalUrl,
        });
        const actualizado = await db.resource.update({ where: { id }, data: d, include });
        if (d.fileId !== undefined && antes.fileId !== d.fileId)
          await soltarDocumento(antes.fileId);
        await audit(req, {
          action: "RESOURCE_UPDATE",
          entity: "Resource",
          entityId: id,
          meta: { campos: changedFields(antes, d) },
        });
        res.json({ item: { ...actualizado, name: actualizado.title } });
      },
    },
    {
      roles: CONTENT_ROLES,
      method: "delete",
      path: "/resources/:id",
      handler: async (req, res) => {
        const id = idParam(req, "El recurso");
        const antes = await db.resource.findUnique({ where: { id } });
        if (!antes) throw notFound("El recurso");
        await db.resource.delete({ where: { id } });
        await soltarDocumento(antes.fileId);
        await audit(req, {
          action: "RESOURCE_DELETE",
          entity: "Resource",
          entityId: id,
          meta: { nombre: antes.title },
        });
        res.status(204).end();
      },
    },
  ];
}
