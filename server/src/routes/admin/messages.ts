import { z } from "zod";
import { notFound, parseOrThrow } from "../../http/errors.js";
import type { AdminDeps } from "./deps.js";
import { idParam, page, paginationSchema } from "./helpers.js";
import { ADMIN_ONLY, type AdminRoute } from "./registry.js";

// Mensajes recibidos por el formulario de contacto de la landing.

const listSchema = paginationSchema.extend({ noLeidos: z.enum(["true", "false"]).optional() });
const readSchema = z.object({ leido: z.boolean("Indica si el mensaje está leído.") });

export function messageRoutes({ db, audit }: AdminDeps): AdminRoute[] {
  async function cargar(id: string) {
    const m = await db.contactMessage.findUnique({ where: { id } });
    if (!m) throw notFound("El mensaje");
    return m;
  }

  return [
    {
      roles: ADMIN_ONLY,
      method: "get",
      path: "/messages",
      handler: async (req, res) => {
        const q = parseOrThrow(listSchema, req.query);
        const filas = await db.contactMessage.findMany({
          where: q.noLeidos === "true" ? { readAt: null } : undefined,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: q.limit + 1,
          ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
        });
        const noLeidos = await db.contactMessage.count({ where: { readAt: null } });
        res.json({ ...page(filas, q.limit), noLeidos });
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "patch",
      path: "/messages/:id",
      handler: async (req, res) => {
        const id = idParam(req, "El mensaje");
        await cargar(id);
        const { leido } = parseOrThrow(readSchema, req.body);
        const message = await db.contactMessage.update({
          where: { id },
          data: { readAt: leido ? new Date() : null },
        });
        res.json({ message });
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "delete",
      path: "/messages/:id",
      handler: async (req, res) => {
        const id = idParam(req, "El mensaje");
        await cargar(id);
        await db.contactMessage.delete({ where: { id } });
        await audit(req, { action: "MESSAGE_DELETE", entity: "ContactMessage", entityId: id });
        res.status(204).end();
      },
    },
  ];
}
