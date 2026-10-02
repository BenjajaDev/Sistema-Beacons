import type { ErrorRequestHandler } from "express";
import type { z } from "zod";
import type { Logger } from "../lib/logger.js";

// Error de API con un mensaje pensado para quien usa el panel: qué pasó y,
// cuando aplica, cómo resolverlo. `code` es estable para que el frontend decida qué hacer.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const unauthenticated = () =>
  new ApiError(401, "UNAUTHENTICATED", "Tu sesión no es válida o expiró. Inicia sesión de nuevo.");

export const forbidden = () =>
  new ApiError(403, "FORBIDDEN", "Tu cuenta no tiene permiso para hacer esta acción.");

export const notFound = (que = "El recurso") =>
  new ApiError(404, "NOT_FOUND", `${que} no existe o fue eliminado.`);

// Valida el cuerpo o la query con zod y devuelve un 400 con el error de cada campo,
// para poder mostrarlo junto al input correspondiente.
export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const campos: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const clave = issue.path.join(".") || "_";
    campos[clave] ??= issue.message;
  }
  throw new ApiError(400, "VALIDATION", "Revisa los campos marcados.", { campos });
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: err.message, code: err.code, ...err.extra });
      return;
    }
    // Errores de body-parser.
    if (err?.type === "entity.parse.failed") {
      res
        .status(400)
        .json({ error: "El cuerpo de la petición no es JSON válido.", code: "BAD_JSON" });
      return;
    }
    if (err?.type === "entity.too.large") {
      res.status(413).json({ error: "La petición es demasiado grande.", code: "TOO_LARGE" });
      return;
    }
    if (err?.code === "EBADCSRFTOKEN") {
      res.status(403).json({
        error: "La página quedó desactualizada. Recárgala e intenta de nuevo.",
        code: "CSRF_INVALID",
      });
      return;
    }
    logger.error({ err, url: req.originalUrl }, "Error no controlado");
    res.status(500).json({
      error:
        "Ocurrió un error inesperado en el servidor. Intenta de nuevo; si persiste, avisa al equipo técnico.",
      code: "INTERNAL",
    });
  };
}
