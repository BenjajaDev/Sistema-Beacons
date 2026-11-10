import type { Response } from "express";
import { z } from "zod";
import { ApiError, notFound, parseOrThrow } from "../../http/errors.js";
import { Prisma } from "../../generated/prisma/client.js";
import { asJson } from "../../lib/json.js";
import type { AdminDeps } from "./deps.js";
import { assertImage, changedFields, idParam, textoOpcional, urlHttps } from "./helpers.js";
import { CONTENT_ROLES, type AdminRoute } from "./registry.js";

// Equipo, Colaboradores, Respaldos y Galería: listas ordenables. Son contenido: las editan
// ADMIN y EDITOR.

const nombre = z.string("Escribe el nombre.").trim().min(1, "Escribe el nombre.").max(120);
const imagenId = z
  .uuid("Imagen no válida.")
  .nullish()
  .transform((v) => v ?? null);

const enlace = z.object({
  red: z.string().trim().min(1).max(40),
  url: urlHttps,
  etiqueta: z.string().trim().max(80).optional(),
});

// Encuadre de la foto: punto de enfoque en % y zoom. Lo aplica la landing con
// object-position y escala, sin recortar el archivo.
const encuadre = z
  .object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    zoom: z.number().min(1).max(3),
  })
  .nullish()
  .transform((v) => v ?? null);

// Ojo: en Zod 4, .partial() aplica los .default(). Por eso el esquema base no tiene
// defaults (sirve para editar) y el de creación los agrega.
const teamBase = z.object({
  name: nombre,
  position: z.string("Escribe el cargo.").trim().min(1, "Escribe el cargo.").max(120),
  bio: textoOpcional(600),
  area: textoOpcional(80),
  education: textoOpcional(120),
  affiliation: textoOpcional(120),
  category: z.enum(["CORE", "ADVISORY", "STUDENTS"], "Elige el grupo de la persona."),
  email: z
    .string()
    .trim()
    .max(200)
    .refine(
      (v) => v === "" || z.email().safeParse(v).success,
      "Escribe un correo válido, por ejemplo nombre@institucion.cl.",
    )
    .nullish()
    .transform((v) => v || null),
  photoId: imagenId,
  photoAlt: textoOpcional(300),
  photoFrame: encuadre,
  links: z.array(enlace).max(6),
  visible: z.boolean(),
});
const teamCreate = teamBase.extend({
  links: teamBase.shape.links.default([]),
  category: teamBase.shape.category.default("CORE"),
  visible: z.boolean().default(true),
});

const collaboratorBase = z.object({
  name: nombre,
  description: textoOpcional(300),
  url: urlHttps.nullish().transform((v) => v ?? null),
  logoId: imagenId,
  logoAlt: textoOpcional(300),
  visible: z.boolean(),
});
// El tipo solo lo tienen los colaboradores (los respaldos usan «kind», un texto libre).
const collaboratorTipado = collaboratorBase.extend({
  type: z.enum(
    ["ACADEMIC", "CIVIL_SOCIETY", "PUBLIC_SECTOR", "COMPANY", "OTHER"],
    "Elige el tipo de organización.",
  ),
});
const collaboratorTipadoCreate = collaboratorTipado.extend({
  type: collaboratorTipado.shape.type.default("OTHER"),
  visible: z.boolean().default(true),
});

// Respaldo institucional: quién financia o patrocina el proyecto. `kind` es el texto
// que acompaña al logo en el sitio («Financia», «Patrocina»).
const backerBase = collaboratorBase.extend({
  kind: z
    .string("Escribe el tipo de respaldo.")
    .trim()
    .min(1, "Escribe el tipo de respaldo, por ejemplo «Financia» o «Patrocina».")
    .max(60, "El tipo de respaldo admite hasta 60 caracteres."),
});
const backerCreate = backerBase.extend({ visible: z.boolean().default(true) });

const orderSchema = z.object({ ids: z.array(z.uuid()).min(1) });

// Foto de la galería: la imagen y su texto alternativo son obligatorios.
const galleryBase = z.object({
  name: z
    .string("Escribe el pie de foto.")
    .trim()
    .min(1, "Escribe el pie de foto.")
    .max(120, "El pie de foto admite hasta 120 caracteres."),
  credit: textoOpcional(120),
  mediaId: z.uuid("Elige la foto."),
  alt: z
    .string("Describe la foto (texto alternativo): es obligatorio.")
    .trim()
    .min(1, "Describe la foto (texto alternativo): es obligatorio.")
    .max(300, "El texto alternativo admite hasta 300 caracteres."),
  visible: z.boolean(),
});
const galleryCreate = galleryBase.extend({ visible: z.boolean().default(true) });

// Operaciones de Prisma que usan ambas colecciones.
interface Coleccion {
  findMany(args: object): Promise<Record<string, unknown>[]>;
  findUnique(args: { where: { id: string } }): Promise<Record<string, unknown> | null>;
  create(args: { data: object }): Promise<{ id: string }>;
  update(args: { where: { id: string }; data: object }): Promise<unknown>;
  delete(args: { where: { id: string } }): Promise<unknown>;
  aggregate(args: { _max: { order: true } }): Promise<{ _max: { order: number | null } }>;
}

interface Config {
  ruta: string;
  entidad: string;
  // Nombre del modelo en el cliente de Prisma (para usarlo dentro de una transacción).
  delegado: "teamMember" | "collaborator" | "backer" | "galleryItem";
  accion: string;
  que: string;
  createSchema: z.ZodObject;
  updateSchema: z.ZodObject;
  coleccion: Coleccion;
  imagen: { id: string; alt: string };
  include: object;
}

function orderedCollection({ db, audit }: AdminDeps, c: Config): AdminRoute[] {
  async function cargar(id: string) {
    const fila = await c.coleccion.findUnique({ where: { id } });
    if (!fila) throw notFound(c.que);
    return fila;
  }

  async function responder(res: Response, id: string, status = 200) {
    const [item] = await c.coleccion.findMany({ where: { id }, include: c.include });
    res.status(status).json({ item });
  }

  // Los enlaces y el encuadre son JSON; el resto de campos pasa tal cual.
  const datos = (d: Record<string, unknown>) => ({
    ...d,
    ...(d.links !== undefined && { links: asJson(d.links) }),
    ...(d.photoFrame !== undefined && {
      photoFrame: d.photoFrame === null ? Prisma.DbNull : asJson(d.photoFrame),
    }),
  });

  return [
    {
      roles: CONTENT_ROLES,
      method: "get",
      path: c.ruta,
      handler: async (_req, res) => {
        res.json({
          items: await c.coleccion.findMany({ orderBy: { order: "asc" }, include: c.include }),
        });
      },
    },
    {
      roles: CONTENT_ROLES,
      method: "put",
      path: `${c.ruta}/order`,
      handler: async (req, res) => {
        const { ids } = parseOrThrow(orderSchema, req.body);
        const actuales = await c.coleccion.findMany({ select: { id: true } });
        const esperados = new Set(actuales.map((a) => a.id as string));
        const completo =
          ids.length === esperados.size &&
          new Set(ids).size === ids.length &&
          ids.every((id) => esperados.has(id));
        if (!completo) {
          throw new ApiError(
            400,
            "VALIDATION",
            "El nuevo orden debe incluir cada elemento una sola vez. Recarga y vuelve a intentarlo.",
          );
        }
        await db.$transaction(async (tx) => {
          const col = tx[c.delegado] as unknown as Coleccion;
          for (const [i, id] of ids.entries()) {
            await col.update({ where: { id }, data: { order: i + 1 } });
          }
        });
        await audit(req, { action: `${c.accion}_REORDER`, entity: c.entidad });
        res.json({ ok: true });
      },
    },
    {
      roles: CONTENT_ROLES,
      method: "post",
      path: c.ruta,
      handler: async (req, res) => {
        const d = parseOrThrow(c.createSchema, req.body) as Record<string, unknown>;
        await assertImage(
          db,
          { id: d[c.imagen.id] as string | null, alt: d[c.imagen.alt] as string | null },
          c.imagen,
        );
        const { _max } = await c.coleccion.aggregate({ _max: { order: true } });
        const creado = await c.coleccion.create({
          data: { ...datos(d), order: (_max.order ?? 0) + 1 },
        });
        await audit(req, { action: `${c.accion}_CREATE`, entity: c.entidad, entityId: creado.id });
        await responder(res, creado.id, 201);
      },
    },
    {
      roles: CONTENT_ROLES,
      method: "patch",
      path: `${c.ruta}/:id`,
      handler: async (req, res) => {
        const id = idParam(req, c.que);
        const antes = await cargar(id);
        const d = parseOrThrow(c.updateSchema, req.body) as Record<string, unknown>;
        const valor = (campo: string) => (campo in d ? d[campo] : antes[campo]) as string | null;
        await assertImage(db, { id: valor(c.imagen.id), alt: valor(c.imagen.alt) }, c.imagen);
        await c.coleccion.update({ where: { id }, data: datos(d) });
        await audit(req, {
          action: `${c.accion}_UPDATE`,
          entity: c.entidad,
          entityId: id,
          meta: { campos: changedFields(antes, d) },
        });
        await responder(res, id);
      },
    },
    {
      roles: CONTENT_ROLES,
      method: "delete",
      path: `${c.ruta}/:id`,
      handler: async (req, res) => {
        const id = idParam(req, c.que);
        const antes = await cargar(id);
        await c.coleccion.delete({ where: { id } });
        await audit(req, {
          action: `${c.accion}_DELETE`,
          entity: c.entidad,
          entityId: id,
          meta: { nombre: String(antes.name) },
        });
        res.status(204).end();
      },
    },
  ];
}

const IMAGEN = { select: { id: true, url: true, width: true, height: true } } as const;

export function teamRoutes(deps: AdminDeps): AdminRoute[] {
  return [
    ...orderedCollection(deps, {
      ruta: "/team",
      entidad: "TeamMember",
      delegado: "teamMember",
      accion: "TEAM_MEMBER",
      que: "La persona",
      createSchema: teamCreate,
      updateSchema: teamBase.partial(),
      coleccion: deps.db.teamMember as unknown as Coleccion,
      imagen: { id: "photoId", alt: "photoAlt" },
      include: { photo: IMAGEN },
    }),
    ...orderedCollection(deps, {
      ruta: "/collaborators",
      entidad: "Collaborator",
      delegado: "collaborator",
      accion: "COLLABORATOR",
      que: "El colaborador",
      createSchema: collaboratorTipadoCreate,
      updateSchema: collaboratorTipado.partial(),
      coleccion: deps.db.collaborator as unknown as Coleccion,
      imagen: { id: "logoId", alt: "logoAlt" },
      include: { logo: IMAGEN },
    }),
    ...orderedCollection(deps, {
      ruta: "/backers",
      entidad: "Backer",
      delegado: "backer",
      accion: "BACKER",
      que: "El respaldo",
      createSchema: backerCreate,
      updateSchema: backerBase.partial(),
      coleccion: deps.db.backer as unknown as Coleccion,
      imagen: { id: "logoId", alt: "logoAlt" },
      include: { logo: IMAGEN },
    }),
    ...orderedCollection(deps, {
      ruta: "/gallery",
      entidad: "GalleryItem",
      delegado: "galleryItem",
      accion: "GALLERY_ITEM",
      que: "La foto",
      createSchema: galleryCreate,
      updateSchema: galleryBase.partial(),
      coleccion: deps.db.galleryItem as unknown as Coleccion,
      imagen: { id: "mediaId", alt: "alt" },
      include: { media: IMAGEN },
    }),
  ];
}
