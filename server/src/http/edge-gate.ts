import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { RequestHandler } from "express";
import { EDGE_CLIENT_IP_HEADER, EDGE_SECRET_HEADER, HEALTH_PATHS } from "./edge-contract.js";
import { ApiError } from "./errors.js";

const digest = (valor: string) => createHash("sha256").update(valor).digest();

// Con EDGE_PROXY_SECRET, el servidor solo atiende lo que llega a través de la
// Function de Cloudflare Pages: lo demás responde 404, como si no existiera.
// Así nadie se salta Cloudflare usando la URL del host ni falsea su IP.
// Sin la variable (desarrollo o un VPS sin proxy), no hace nada.
export function edgeGate(secret: string | undefined): RequestHandler {
  if (!secret) return (_req, _res, next) => next();
  const esperado = digest(secret);
  const libres = new Set(HEALTH_PATHS);

  return (req, _res, next) => {
    if (libres.has(req.path)) return next();
    const recibido = req.get(EDGE_SECRET_HEADER);
    // Se comparan los hashes: misma longitud y tiempo constante.
    if (!recibido || !timingSafeEqual(digest(recibido), esperado)) {
      throw new ApiError(404, "NOT_FOUND", "No encontrado");
    }
    const ip = req.get(EDGE_CLIENT_IP_HEADER)?.trim();
    if (ip && isIP(ip)) {
      // Propiedad propia: oculta el getter de Express, que leería la IP de Cloudflare.
      Object.defineProperty(req, "ip", { value: ip, enumerable: true, configurable: true });
    }
    next();
  };
}
