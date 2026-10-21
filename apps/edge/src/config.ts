import { z } from "zod";

// Variables de la Function, definidas en Cloudflare: Workers & Pages → el proyecto
// → Settings → Variables and Secrets. Ver docs/cloudflare-pages.md.

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const edgeEnvSchema = z.object({
  // Origen del servidor Express, por ejemplo https://signal-api.onrender.com.
  BACKEND_ORIGIN: z
    .url("BACKEND_ORIGIN debe ser una URL completa, por ejemplo https://signal-api.onrender.com.")
    .transform((valor) => new URL(valor))
    .refine(
      (url) =>
        url.protocol === "https:" || (url.protocol === "http:" && HOSTS_LOCALES.has(url.hostname)),
      "BACKEND_ORIGIN debe usar https (http solo con localhost, para probar en local).",
    )
    .refine(
      (url) => url.pathname === "/" && !url.search && !url.hash,
      "BACKEND_ORIGIN es solo el origen: sin ruta, parámetros ni #.",
    )
    .transform((url) => url.origin),
  // El mismo valor que EDGE_PROXY_SECRET en el servidor.
  EDGE_PROXY_SECRET: z
    .string("Falta EDGE_PROXY_SECRET.")
    .min(32, "EDGE_PROXY_SECRET debe tener al menos 32 caracteres. Genéralo con: npm run secret"),
});

export type EdgeConfig = z.infer<typeof edgeEnvSchema>;

export type EdgeConfigResult =
  { ok: true; config: EdgeConfig } | { ok: false; problemas: string[] };

// Los mensajes nombran la variable, nunca su valor: terminan en los logs de Cloudflare.
export function readEdgeConfig(env: Partial<Record<keyof EdgeConfig, unknown>>): EdgeConfigResult {
  const parsed = edgeEnvSchema.safeParse(env);
  if (parsed.success) return { ok: true, config: parsed.data };
  return {
    ok: false,
    problemas: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}
