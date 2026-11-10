// Contrato entre la Function de Cloudflare Pages (apps/edge) y este servidor.
// Sin dependencias: lo importan los dos lados.

// Secreto compartido: prueba que la petición pasó por Cloudflare y no llegó
// directo a la URL del host del servidor.
export const EDGE_SECRET_HEADER = "x-signal-edge-secret";

// IP real de quien visita (CF-Connecting-IP), para el rate limit y la bitácora.
// Solo se cree si la petición trae el secreto correcto.
export const EDGE_CLIENT_IP_HEADER = "x-signal-client-ip";

// Rutas que el host consulta directamente para saber si el proceso está vivo.
export const HEALTH_PATHS: readonly string[] = ["/api/health", "/api/health/live"];
