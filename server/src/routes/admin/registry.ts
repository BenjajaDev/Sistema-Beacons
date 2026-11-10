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
  // Varios handlers para encadenar middlewares (por ejemplo, la subida de archivos).
  handler: RequestHandler | RequestHandler[];
}

export function mountAdminRoutes(router: Router, routes: AdminRoute[]) {
  for (const r of routes) router[r.method](r.path, requireRole(r), ...[r.handler].flat());
}

export const ADMIN_ONLY = ["ADMIN"] as const;
// Noticias, secciones, equipo, identidad visual, pie de página e imágenes.
export const CONTENT_ROLES = ["ADMIN", "EDITOR"] as const;
// La propia cuenta, los mensajes de contacto y los datos de contacto y redes.
export const ALL_ROLES = ["ADMIN", "EDITOR", "SOCIAL"] as const;
// Suscriptores del boletín: datos personales de quien pidió recibirlo. Los ve la
// administración y quien lleva la comunicación, no la edición de contenido.
export const COMUNICACION = ["ADMIN", "SOCIAL"] as const;
