import { describe, expect, it, vi } from "vitest";
import {
  EDGE_CLIENT_IP_HEADER,
  EDGE_SECRET_HEADER,
} from "../../../server/src/http/edge-contract.ts";
import { destinoDe, handleRequest, type AssetFetcher, type EdgeEnv } from "../src/proxy.ts";

const PUBLICO = "https://signal.example";
const SERVIDOR = "https://signal-api.onrender.com";
const SECRETO = "secreto-de-la-function-0123456789abcdef0123";

// Imita el binding ASSETS de Pages: archivos por ruta, /x.html redirige a /x y lo
// que no existe responde 404 (hay 404.html, así que no hay modo SPA).
function assetsFalsos(archivos: Record<string, { cuerpo: string; tipo: string }>): AssetFetcher {
  return {
    fetch: async (request) => {
      const { pathname } = new URL(request.url);
      if (pathname.endsWith(".html") && archivos[pathname.slice(0, -5)]) {
        return new Response(null, { status: 308, headers: { Location: pathname.slice(0, -5) } });
      }
      const archivo = archivos[pathname];
      if (!archivo) return new Response("no encontrado", { status: 404 });
      return new Response(archivo.cuerpo, {
        headers: { "Content-Type": archivo.tipo, "Access-Control-Allow-Origin": "*" },
      });
    },
  };
}

const ASSETS = assetsFalsos({
  "/assets/index-abc123.js": { cuerpo: "console.log(1)", tipo: "application/javascript" },
  "/sw.js": { cuerpo: "self.addEventListener()", tipo: "application/javascript" },
  "/offline": { cuerpo: "<h1>Estás sin conexión</h1>", tipo: "text/html; charset=utf-8" },
  "/sin-servidor": { cuerpo: "<h1>SIGNAL no responde</h1>", tipo: "text/html; charset=utf-8" },
});

const env: EdgeEnv = { ASSETS, BACKEND_ORIGIN: SERVIDOR, EDGE_PROXY_SECRET: SECRETO };

// Servidor falso que registra lo que recibe.
function servidorQueResponde(respuesta: () => Response) {
  const recibidas: Request[] = [];
  const upstream = vi.fn(async (request: Request) => {
    recibidas.push(request);
    return respuesta();
  });
  return { upstream, recibidas };
}

const peticion = (ruta: string, init?: RequestInit) => new Request(`${PUBLICO}${ruta}`, init);

describe("destinoDe", () => {
  it.each([
    ["/assets/index-abc123.js", "estaticos"],
    ["/icons/icon-192.png", "estaticos"],
    ["/sw.js", "estaticos"],
    ["/manifest.webmanifest", "estaticos"],
    ["/offline.html", "estaticos"],
    ["/robots.txt", "estaticos"],
    ["/", "servidor"],
    ["/nosotros", "servidor"],
    ["/noticias/una-nota", "servidor"],
    ["/index.html", "servidor"],
    ["/404.html", "servidor"],
    ["/beacons/1/1", "servidor"],
    ["/api/public/site", "servidor"],
    ["/api/admin/media/foto.webp", "servidor"],
    ["/ruta-del-panel-desconocida", "servidor"],
  ])("GET %s → %s", (ruta, destino) => {
    expect(destinoDe("GET", ruta)).toBe(destino);
  });

  it("todo lo que no es GET o HEAD va al servidor", () => {
    expect(destinoDe("POST", "/assets/index-abc123.js")).toBe("servidor");
  });
});

describe("archivos estáticos", () => {
  it("salen de Pages sin tocar el servidor, con caché inmutable y sin CORS abierto", async () => {
    const { upstream } = servidorQueResponde(() => new Response("no"));
    const res = await handleRequest(peticion("/assets/index-abc123.js"), env, upstream);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("console.log(1)");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(upstream).not.toHaveBeenCalled();
  });

  it("sw.js no recibe caché inmutable (las actualizaciones deben llegar)", async () => {
    const res = await handleRequest(peticion("/sw.js"), env);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("sigue la redirección de Pages y sirve /offline.html en la misma URL, con CSP", async () => {
    const res = await handleRequest(peticion("/offline.html"), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Estás sin conexión");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("si Pages no lo tiene, lo pide al servidor (assets del panel o de otro build)", async () => {
    const { upstream, recibidas } = servidorQueResponde(() => new Response("panel"));
    const res = await handleRequest(peticion("/ruta-oculta/assets/admin-x.js"), env, upstream);
    expect(await res.text()).toBe("panel");
    expect(recibidas[0]?.url).toBe(`${SERVIDOR}/ruta-oculta/assets/admin-x.js`);
  });

  it("funcionan aunque falte la configuración del servidor", async () => {
    const res = await handleRequest(peticion("/sw.js"), { ASSETS });
    expect(res.status).toBe(200);
  });
});

describe("reenvío al servidor", () => {
  it("conserva ruta, query, método y cuerpo, y agrega el secreto y la IP real", async () => {
    const { upstream, recibidas } = servidorQueResponde(() => Response.json({ ok: true }));
    await handleRequest(
      peticion("/api/public/contact?x=1", {
        method: "POST",
        body: JSON.stringify({ nombre: "Ana" }),
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.7",
          Cookie: "__Host-signal_session=abc",
        },
      }),
      env,
      upstream,
    );
    const enviada = recibidas[0];
    expect(enviada?.url).toBe(`${SERVIDOR}/api/public/contact?x=1`);
    expect(enviada?.method).toBe("POST");
    expect(enviada?.redirect).toBe("manual");
    expect(await enviada?.json()).toEqual({ nombre: "Ana" });
    expect(enviada?.headers.get(EDGE_SECRET_HEADER)).toBe(SECRETO);
    expect(enviada?.headers.get(EDGE_CLIENT_IP_HEADER)).toBe("203.0.113.7");
    expect(enviada?.headers.get("Cookie")).toBe("__Host-signal_session=abc");
    expect(enviada?.headers.get("X-Forwarded-Host")).toBe("signal.example");
    expect(enviada?.headers.get("X-Forwarded-Proto")).toBe("https");
  });

  it("descarta una IP o un secreto enviados por quien visita", async () => {
    const { upstream, recibidas } = servidorQueResponde(() => new Response("ok"));
    await handleRequest(
      peticion("/beacons/1/1", {
        headers: { [EDGE_CLIENT_IP_HEADER]: "1.2.3.4", [EDGE_SECRET_HEADER]: "inventado" },
      }),
      env,
      upstream,
    );
    expect(recibidas[0]?.headers.get(EDGE_CLIENT_IP_HEADER)).toBeNull();
    expect(recibidas[0]?.headers.get(EDGE_SECRET_HEADER)).toBe(SECRETO);
  });

  it("devuelve la respuesta del servidor tal cual: estado, cuerpo y cookies", async () => {
    const { upstream } = servidorQueResponde(() => {
      const headers = new Headers({ "Content-Type": "application/json" });
      headers.append("Set-Cookie", "__Host-signal_session=jwt; Path=/; Secure; HttpOnly");
      headers.append("Set-Cookie", "__Host-signal_csrf=t; Path=/; Secure");
      return new Response(JSON.stringify({ error: "No hay información para el beacon 9-9" }), {
        status: 404,
        headers,
      });
    });
    const res = await handleRequest(peticion("/beacons/9/9"), env, upstream);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No hay información para el beacon 9-9" });
    expect(res.headers.getSetCookie()).toHaveLength(2);
  });

  it("reescribe una redirección absoluta al host del servidor", async () => {
    const { upstream } = servidorQueResponde(
      () => new Response(null, { status: 302, headers: { Location: `${SERVIDOR}/nosotros?a=1` } }),
    );
    const res = await handleRequest(peticion("/x"), env, upstream);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`${PUBLICO}/nosotros?a=1`);
  });

  it("no toca una redirección relativa ni una a otro sitio", async () => {
    for (const location of ["/noticias", "https://otro.example/x"]) {
      const { upstream } = servidorQueResponde(
        () => new Response(null, { status: 301, headers: { Location: location } }),
      );
      const res = await handleRequest(peticion("/x"), env, upstream);
      expect(res.headers.get("Location")).toBe(location);
    }
  });

  it("deja pasar el 503 propio del servidor (/api/health sin base)", async () => {
    const { upstream } = servidorQueResponde(() =>
      Response.json({ ok: false, db: "sin conexión" }, { status: 503 }),
    );
    const res = await handleRequest(peticion("/api/health"), env, upstream);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: "sin conexión" });
  });
});

describe("servidor caído", () => {
  const caido = async () => {
    throw new TypeError("fetch failed");
  };

  it("una página responde 503 con la página «sin servidor», sin caché", async () => {
    const res = await handleRequest(
      peticion("/nosotros", { headers: { Accept: "text/html,application/xhtml+xml" } }),
      env,
      caido,
    );
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("SIGNAL no responde");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("la API y la app Android reciben un 502 en JSON con { error, code }", async () => {
    const res = await handleRequest(peticion("/beacons/1/1"), env, caido);
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      error: expect.any(String),
    });
  });

  it.each([502, 504, 522, 530])(
    "un %i de la plataforma cuenta como servidor caído",
    async (status) => {
      const { upstream } = servidorQueResponde(() => new Response("Bad Gateway", { status }));
      const res = await handleRequest(peticion("/api/public/site"), env, upstream);
      expect(res.status).toBe(502);
    },
  );
});

describe("configuración", () => {
  const llamar = (overrides: Partial<EdgeEnv>) =>
    handleRequest(
      peticion("/beacons/1/1"),
      { ...env, ...overrides },
      async () => new Response("ok"),
    );

  it.each([
    ["sin BACKEND_ORIGIN", { BACKEND_ORIGIN: undefined }],
    ["BACKEND_ORIGIN por http", { BACKEND_ORIGIN: "http://signal-api.onrender.com" }],
    ["BACKEND_ORIGIN con ruta", { BACKEND_ORIGIN: `${SERVIDOR}/api` }],
    ["secreto corto", { EDGE_PROXY_SECRET: "corto" }],
  ])("%s → 500 sin revelar valores", async (_caso, overrides) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await llamar(overrides);
    expect(res.status).toBe(500);
    const cuerpo = await res.text();
    expect(cuerpo).toContain("EDGE_MISCONFIGURED");
    expect(cuerpo).not.toContain(SECRETO);
    expect(error.mock.calls.flat().join(" ")).not.toContain(SECRETO);
    error.mockRestore();
  });

  it("acepta http solo con localhost, para probar en local", async () => {
    const res = await llamar({ BACKEND_ORIGIN: "http://localhost:3000" });
    expect(res.status).toBe(200);
  });
});
