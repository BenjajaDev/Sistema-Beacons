import type { RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import type { ServerEnv } from "../config/env.js";
import { ApiError } from "./errors.js";

export function securityHeaders(env: ServerEnv): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Las variables del tema se inyectan en un <style> del HTML.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", ...env.imgHosts],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        ...(env.isProduction && { upgradeInsecureRequests: [] }),
      },
    },
    strictTransportSecurity: env.isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true }
      : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  });
}

// CORS cerrado: sin CORS_ORIGINS, solo el mismo origen puede llamar a la API.
export function corsPolicy(env: ServerEnv): RequestHandler {
  return cors({
    origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    maxAge: 600,
  });
}

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

// Defensa adicional contra CSRF: si el navegador envía Origin en una petición que
// modifica datos, debe ser el propio sitio o uno de CORS_ORIGINS.
export function originCheck(env: ServerEnv): RequestHandler {
  const permitidos = new Set(env.CORS_ORIGINS);
  return (req, _res, next) => {
    const origin = req.get("origin");
    if (!origin || METODOS_SEGUROS.has(req.method)) return next();
    const propio = `${req.protocol}://${req.get("host")}`;
    if (origin === propio || permitidos.has(origin)) return next();
    throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "Petición rechazada: origen no permitido.");
  };
}
