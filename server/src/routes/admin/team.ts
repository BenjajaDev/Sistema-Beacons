import type { Response } from "express";
import { z } from "zod";
import { ApiError, notFound, parseOrThrow } from "../../http/errors.js";
import { asJson } from "../../lib/json.js";
import type { AdminDeps } from "./deps.js";
import { assertImage, changedFields, idParam, textoOpcional, urlHttps } from "./helpers.js";
import { ADMIN_ONLY, type AdminRoute } from "./registry.js";

// Equipo y Colaboradores: listas ordenables que solo administra el rol ADMIN.

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

// Ojo: en Zod 4, .partial() aplica los .default(). Por eso el esquema base no tiene
// defaults (sirve para editar) y el de creación los agrega.
const teamBase = z.object({
  name: nombre,
  position: z.string("Escribe el cargo.").trim().min(1, "Escribe el cargo.").max(120),
  bio: textoOpcional(600),
  photoId: imagenId,
  photoAlt: textoOpcional(300),
  links: z.array(enlace).max(6),
  visible: z.boolean(),
});
const teamCreate = teamBase.extend({
  links: teamBase.shape.links.default([]),
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
const collaboratorCreate = collaboratorBase.extend({ visible: z.boolean().default(true) });

const orderSchema = z.object({ ids: z.array(z.uuid()).min(1) });

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

  // Los enlaces son JSON; el resto de campos pasa tal cual.
  const datos = (d: Record<string, unknown>) =>
    d.links === undefined ? d : { ...d, links: asJson(d.links) };

  return [
    {
      roles: ADMIN_ONLY,
      method: "get",
      path: c.ruta,
      handler: async (_req, res) => {
        res.json({
          items: await c.coleccion.findMany({ orderBy: { order: "asc" }, include: c.include }),
        });
      },
    },
    {
      roles: ADMIN_ONLY,
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
          const col = (tx as unknown as Record<string, Coleccion>)[
            c.entidad === "TeamMember" ? "teamMember" : "collaborator"
          ]!;
          for (const [i, id] of ids.entries()) {
            await col.update({ where: { id }, data: { order: i + 1 } });
          }
        });
        await audit(req, { action: `${c.accion}_REORDER`, entity: c.entidad });
        res.json({ ok: true });
      },
    },
    {
      roles: ADMIN_ONLY,
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
      roles: ADMIN_ONLY,
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
      roles: ADMIN_ONLY,
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
      accion: "COLLABORATOR",
      que: "El colaborador",
      createSchema: collaboratorCreate,
      updateSchema: collaboratorBase.partial(),
      coleccion: deps.db.collaborator as unknown as Coleccion,
      imagen: { id: "logoId", alt: "logoAlt" },
      include: { logo: IMAGEN },
    }),
  ];
}
