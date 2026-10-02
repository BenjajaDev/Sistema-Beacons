import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ServerEnv } from "../config/env.js";

// Dónde se guardan los archivos subidos. En desarrollo, en disco (server/uploads,
// servido en /uploads). En producción, en un bucket público de Supabase Storage.

export interface MediaStorage {
  put(key: string, data: Buffer, contentType: string): Promise<{ url: string }>;
  remove(key: string): Promise<void>;
}

export function localStorage(dir: string): MediaStorage {
  return {
    async put(key, data) {
      const destino = path.join(dir, key);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, data, { flag: "wx" });
      return { url: `/uploads/${key}` };
    },
    async remove(key) {
      await rm(path.join(dir, key), { force: true });
    },
  };
}

// Usa la API REST de Storage directamente (sin SDK). La service role key solo vive
// en el servidor: nunca debe llegar al navegador.
export function supabaseStorage(
  config: { url: string; serviceRoleKey: string; bucket: string },
  fetchFn: typeof fetch = fetch,
): MediaStorage {
  const base = config.url.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${config.serviceRoleKey}`,
    apikey: config.serviceRoleKey,
  };
  return {
    async put(key, data, contentType) {
      const res = await fetchFn(`${base}/storage/v1/object/${config.bucket}/${key}`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": contentType,
          "Cache-Control": "max-age=31536000",
          "x-upsert": "false",
        },
        body: new Uint8Array(data),
      });
      if (!res.ok) {
        throw new Error(`Supabase Storage respondió ${res.status}: ${await res.text()}`);
      }
      return { url: `${base}/storage/v1/object/public/${config.bucket}/${key}` };
    },
    async remove(key) {
      const res = await fetchFn(`${base}/storage/v1/object/${config.bucket}`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [key] }),
      });
      if (!res.ok) {
        throw new Error(`Supabase Storage respondió ${res.status} al borrar: ${await res.text()}`);
      }
    },
  };
}

export function createMediaStorage(env: ServerEnv): MediaStorage {
  if (env.STORAGE_DRIVER === "supabase") {
    return supabaseStorage({
      url: env.SUPABASE_URL!,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY!,
      bucket: env.SUPABASE_BUCKET,
    });
  }
  return localStorage(env.uploadDir);
}
