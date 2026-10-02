import { z } from "zod";
import { parseOrThrow } from "../../http/errors.js";
import type { AdminDeps } from "./deps.js";
import { ADMIN_ONLY, type AdminRoute } from "./registry.js";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
  action: z
    .string()
    .regex(/^[A-Z_]+$/)
    .optional(),
  userId: z.uuid().optional(),
});

export function auditLogRoutes({ db }: AdminDeps): AdminRoute[] {
  return [
    {
      roles: ADMIN_ONLY,
      method: "get",
      path: "/audit",
      handler: async (req, res) => {
        const q = parseOrThrow(querySchema, req.query);
        const filas = await db.auditLog.findMany({
          where: { action: q.action, userId: q.userId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: q.limit + 1,
          ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
          include: { user: { select: { id: true, name: true, email: true } } },
        });
        const hayMas = filas.length > q.limit;
        const items = hayMas ? filas.slice(0, q.limit) : filas;
        res.json({ items, nextCursor: hayMas ? items.at(-1)!.id : null });
      },
    },
  ];
}
