import type { RequestHandler } from "express";
import type { Role } from "../generated/prisma/enums.js";
import type { Db } from "../lib/prisma.js";
import { ApiError, forbidden, unauthenticated } from "../http/errors.js";
import type { SessionService } from "./session.js";

// Lee la cookie de sesión, verifica el JWT y carga el usuario desde la base.
// Cada petición comprueba que la cuenta siga activa y que el token no haya sido
// revocado (versión de credenciales), así que desactivar a alguien corta su acceso al instante.
export function authenticate(db: Db, sessions: SessionService): RequestHandler {
  return async (req, res, next) => {
    const claims = await sessions.read(req);
    if (!claims) throw unauthenticated();

    const user = await db.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mustChangePassword: true,
        active: true,
        tokenVersion: true,
      },
    });
    if (!user || !user.active || user.tokenVersion !== claims.ver) {
      sessions.clear(res);
      throw unauthenticated();
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    req.sessionId = claims.jti;
    next();
  };
}

export interface RouteGuard {
  roles: readonly Role[];
  // Rutas disponibles aunque la cuenta deba cambiar su contraseña (me, logout, change-password).
  allowPendingPasswordChange?: boolean;
}

export function requireRole(guard: RouteGuard): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthenticated();
    if (!guard.roles.includes(req.user.role)) throw forbidden();
    if (req.user.mustChangePassword && !guard.allowPendingPasswordChange) {
      throw new ApiError(
        403,
        "PASSWORD_CHANGE_REQUIRED",
        "Debes cambiar tu contraseña antes de continuar.",
      );
    }
    next();
  };
}
