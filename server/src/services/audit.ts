import type { Request } from "express";
import type { Prisma } from "../generated/prisma/client.js";
import type { Logger } from "../lib/logger.js";
import type { Db } from "../lib/prisma.js";

// Bitácora: quién hizo qué y cuándo. Las acciones son verbos estables en
// mayúsculas (LOGIN_OK, NEWS_PUBLISH...) para poder filtrarlas en el panel.

export interface AuditEntry {
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
  // Por defecto, el usuario de la sesión.
  userId?: string | null;
}

export function createAudit(db: Db, logger: Logger) {
  return async function audit(req: Request, entry: AuditEntry) {
    try {
      await db.auditLog.create({
        data: {
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          meta: entry.meta,
          userId: entry.userId === undefined ? (req.user?.id ?? null) : entry.userId,
          ip: req.ip ?? null,
          userAgent: req.get("user-agent")?.slice(0, 300) ?? null,
        },
      });
    } catch (err) {
      // La bitácora no debe tumbar la acción del usuario, pero el fallo queda en los logs.
      logger.error({ err, action: entry.action }, "No se pudo registrar en la bitácora");
    }
  };
}

export type Audit = ReturnType<typeof createAudit>;
