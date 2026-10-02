import type { RequestHandler, Router } from "express";
import { requireRole, type RouteGuard } from "../../auth/middleware.js";

// Todas las rutas de /api/admin se declaran como datos: método, ruta y roles.
// La tabla resultante se monta en el router y también la recorre el test de
// permisos, así que una ruta nueva queda cubierta (401 sin sesión, 403 con rol
// insuficiente) sin escribir un test aparte.

export type Method = "get" | "post" | "put" | "patch" | "delete";

export interface AdminRoute extends RouteGuard {
  method: Method;
  // Relativa a /api/admin.
  path: string;
  handler: RequestHandler;
}

export function mountAdminRoutes(router: Router, routes: AdminRoute[]) {
  for (const r of routes) router[r.method](r.path, requireRole(r), r.handler);
}

export const ADMIN_ONLY = ["ADMIN"] as const;
export const ANY_ROLE = ["ADMIN", "EDITOR"] as const;
