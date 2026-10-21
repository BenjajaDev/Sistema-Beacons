import type { SessionUser } from "../auth/session.js";

declare global {
  namespace Express {
    interface Request {
      // Usuario autenticado. Solo existe en las rutas de /api/admin tras `authenticate`.
      user?: SessionUser;
      // Identificador de la sesión (jti del JWT). Ata el token CSRF a la sesión.
      sessionId?: string;
    }
  }
}

export {};
