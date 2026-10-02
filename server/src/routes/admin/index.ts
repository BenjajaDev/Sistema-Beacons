import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { authenticate } from "../../auth/middleware.js";
import { ApiError } from "../../http/errors.js";
import { auditLogRoutes } from "./audit-log.js";
import { authRoutes, loginHandler } from "./auth.js";
import { beaconRoutes } from "./beacons.js";
import { mediaRoutes } from "./media.js";
import { messageRoutes } from "./messages.js";
import { newsRoutes } from "./news.js";
import { sectionRoutes } from "./sections.js";
import { settingsRoutes } from "./settings.js";
import { teamRoutes } from "./team.js";
import { userRoutes } from "./users.js";
import type { AdminDeps } from "./deps.js";
import { mountAdminRoutes, type AdminRoute } from "./registry.js";

export function adminRouteTable(deps: AdminDeps): AdminRoute[] {
  return [
    ...authRoutes(deps),
    ...newsRoutes(deps),
    ...sectionRoutes(deps),
    ...teamRoutes(deps),
    ...settingsRoutes(deps),
    ...mediaRoutes(deps),
    ...beaconRoutes(deps),
    ...userRoutes(deps),
    ...messageRoutes(deps),
    ...auditLogRoutes(deps),
  ];
}

function rateLimited(mensaje: string) {
  return (_req: unknown, _res: unknown, next: (err: unknown) => void) =>
    next(new ApiError(429, "RATE_LIMITED", mensaje));
}

// API del panel, montada en /api/admin. Orden de las capas:
//   límite general → login (único endpoint sin sesión) → sesión (401) →
//   CSRF en métodos que modifican (403) → rol de cada ruta (403).
export function adminApi(deps: AdminDeps) {
  const router = Router();
  const routes = adminRouteTable(deps);

  router.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  router.use(
    rateLimit({
      windowMs: 60_000,
      limit: deps.env.API_RATE_LIMIT,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: rateLimited("Demasiadas peticiones seguidas. Espera un minuto e intenta de nuevo."),
    }),
  );

  router.post(
    "/auth/login",
    rateLimit({
      windowMs: 15 * 60_000,
      limit: deps.env.LOGIN_RATE_LIMIT,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: rateLimited(
        "Demasiados intentos de inicio de sesión desde esta conexión. Espera 15 minutos e intenta de nuevo.",
      ),
    }),
    loginHandler(deps),
  );

  router.use(authenticate(deps.db, deps.sessions));
  router.use(deps.csrf.doubleCsrfProtection);
  mountAdminRoutes(router, routes);

  // Con sesión válida, una ruta inexistente es un 404 normal.
  router.use(() => {
    throw new ApiError(404, "NOT_FOUND", "Esta acción no existe.");
  });

  return { router, routes };
}
