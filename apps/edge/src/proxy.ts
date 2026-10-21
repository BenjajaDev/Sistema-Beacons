import {
  EDGE_CLIENT_IP_HEADER,
  EDGE_SECRET_HEADER,
} from "../../../server/src/http/edge-contract.ts";
import { readEdgeConfig, type EdgeConfig } from "./config.ts";
import { PAGINA_SIN_SERVIDOR, rutaDe } from "./pages-files.ts";

// Cloudflare Pages delante del servidor Express, con un solo dominio:
//
// - Los archivos con extensión (JS, CSS, íconos, sw.js, manifest) salen de la CDN
//   de Pages. Si Pages no tiene uno, se pide al servidor: así funcionan los assets
//   del panel y los de un build distinto (mientras un despliegue va por delante
//   del otro, el HTML del servidor puede apuntar a assets que Pages aún no tiene).
// - Todo lo demás va al servidor: el HTML (con datos y tema inyectados), /api,
//   /beacons (la app Android), robots.txt, sitemap.xml y el panel. La Function no
//   conoce ADMIN_PATH.
//
// Al ser el mismo origen, las cookies __Host-, el CSRF y la CSP no cambian.

// Binding ASSETS de Pages: los archivos de esta implementación.
export interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface EdgeEnv {
  ASSETS: AssetFetcher;
  BACKEND_ORIGIN?: string;
  EDGE_PROXY_SECRET?: string;
}

export type Upstream = (request: Request) => Promise<Response>;

type Destino = "estaticos" | "servidor";

const PREFIJOS_DEL_SERVIDOR = ["/api/", "/beacons/"];
// index.html es la plantilla que el servidor completa con datos: tal cual no sirve.
const DOCUMENTOS_DE_PAGES = new Set(["/index.html", "/404.html"]);
const CON_EXTENSION = /\.[a-z0-9]+$/i;

// Respuestas de Render o de Cloudflare cuando el servidor no está disponible.
// El servidor nunca las emite: su 503 (/api/health) pasa tal cual.
const ESTADOS_SIN_SERVIDOR = new Set([502, 504, 520, 521, 522, 523, 524, 525, 526, 530]);

// Las cabeceras de helmet solo llegan en las respuestas del servidor; estas
// cubren lo que sale de la CDN.
const CABECERAS_ESTATICOS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};
const CSP_HTML_ESTATICO =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

export function destinoDe(method: string, pathname: string): Destino {
  if (method !== "GET" && method !== "HEAD") return "servidor";
  if (PREFIJOS_DEL_SERVIDOR.some((prefijo) => pathname.startsWith(prefijo))) return "servidor";
  if (DOCUMENTOS_DE_PAGES.has(pathname)) return "servidor";
  return CON_EXTENSION.test(pathname) ? "estaticos" : "servidor";
}

export async function handleRequest(
  request: Request,
  env: EdgeEnv,
  upstream: Upstream = (r) => fetch(r),
): Promise<Response> {
  const url = new URL(request.url);
  if (destinoDe(request.method, url.pathname) === "estaticos") {
    const estatico = await servirEstatico(request, env.ASSETS);
    if (estatico) return estatico;
  }

  const lectura = readEdgeConfig(env);
  if (!lectura.ok) {
    // Error de despliegue, no de quien visita: queda en los logs de la Function.
    console.error(
      `Configuración inválida de la Function:\n  - ${lectura.problemas.join("\n  - ")}`,
    );
    return errorJson(
      500,
      "EDGE_MISCONFIGURED",
      "El sitio no está bien configurado. Avísanos, por favor.",
    );
  }
  return reenviar(request, lectura.config, env.ASSETS, upstream);
}

async function servirEstatico(request: Request, assets: AssetFetcher): Promise<Response | null> {
  let respuesta = await assets.fetch(request);
  // Pages redirige /archivo.html a /archivo. Se sigue aquí para responder en la
  // misma URL, como hace el servidor.
  const location = respuesta.headers.get("location");
  if (esRedireccion(respuesta.status) && location) {
    respuesta = await assets.fetch(new Request(new URL(location, request.url), request));
  }
  if (!respuesta.ok && respuesta.status !== 304) return null;
  const copia = conCabecerasDeEstaticos(respuesta);
  // Los assets llevan hash en el nombre: se pueden cachear para siempre.
  if (new URL(request.url).pathname.startsWith("/assets/")) {
    copia.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  return copia;
}

function conCabecerasDeEstaticos(respuesta: Response, status = respuesta.status) {
  const copia = new Response(respuesta.body, { status, headers: respuesta.headers });
  for (const [nombre, valor] of Object.entries(CABECERAS_ESTATICOS))
    copia.headers.set(nombre, valor);
  // Pages agrega CORS abierto a los estáticos; aquí CORS está cerrado, como en el servidor.
  copia.headers.delete("Access-Control-Allow-Origin");
  if (copia.headers.get("Content-Type")?.startsWith("text/html")) {
    copia.headers.set("Content-Security-Policy", CSP_HTML_ESTATICO);
  }
  return copia;
}

async function reenviar(
  request: Request,
  config: EdgeConfig,
  assets: AssetFetcher,
  upstream: Upstream,
): Promise<Response> {
  const url = new URL(request.url);
  const destino = new URL(url.pathname + url.search, config.BACKEND_ORIGIN);

  const headers = new Headers(request.headers);
  headers.delete("Host");
  headers.set(EDGE_SECRET_HEADER, config.EDGE_PROXY_SECRET);
  // Solo vale la IP que informa Cloudflare; un valor enviado por quien visita se descarta.
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) headers.set(EDGE_CLIENT_IP_HEADER, ip);
  else headers.delete(EDGE_CLIENT_IP_HEADER);
  headers.set("X-Forwarded-Host", url.host);
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

  // El primer Request copia el método y el cuerpo (en stream, sin leerlo); el
  // segundo cambia las cabeceras y no sigue redirecciones: van al navegador.
  const salida = new Request(new Request(destino, request), { headers, redirect: "manual" });

  let respuesta: Response;
  try {
    respuesta = await upstream(salida);
  } catch {
    return sinServidor(request, assets);
  }
  if (ESTADOS_SIN_SERVIDOR.has(respuesta.status)) return sinServidor(request, assets);
  return conLocationPublica(respuesta, config.BACKEND_ORIGIN, url.origin);
}

// Una redirección absoluta al host del servidor se reescribe al dominio público.
// Las relativas ya funcionan en el dominio público y quedan igual.
function conLocationPublica(respuesta: Response, origenServidor: string, origenPublico: string) {
  const location = respuesta.headers.get("Location");
  if (!location || !URL.canParse(location)) return respuesta;
  const destino = new URL(location);
  if (destino.origin !== origenServidor) return respuesta;
  const copia = new Response(respuesta.body, respuesta);
  copia.headers.set("Location", origenPublico + destino.pathname + destino.search + destino.hash);
  return copia;
}

async function sinServidor(request: Request, assets: AssetFetcher): Promise<Response> {
  const quiereHtml =
    request.method === "GET" && request.headers.get("Accept")?.includes("text/html");
  if (quiereHtml) {
    const pagina = await assets.fetch(
      new Request(new URL(rutaDe(PAGINA_SIN_SERVIDOR), request.url)),
    );
    if (pagina.ok) {
      const respuesta = conCabecerasDeEstaticos(pagina, 503);
      respuesta.headers.set("Cache-Control", "no-store");
      respuesta.headers.set("Retry-After", "60");
      return respuesta;
    }
  }
  return errorJson(
    502,
    "UPSTREAM_UNAVAILABLE",
    "El servidor no responde. Vuelve a intentarlo en unos minutos.",
  );
}

// Misma forma que los errores del servidor: { error, code }.
function errorJson(status: number, code: string, error: string) {
  return Response.json(
    { error, code },
    { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}

const esRedireccion = (status: number) => status >= 300 && status < 400 && status !== 304;
