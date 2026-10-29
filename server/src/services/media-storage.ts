import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ServerEnv } from "../config/env.js";
import { cabecerasDeSupabase } from "../config/supabase-key.js";
import { ApiError } from "../http/errors.js";

// Dónde se guardan los archivos subidos. En desarrollo, en disco (server/uploads,
// servido en /uploads). En producción, en un bucket público de Supabase Storage.

export interface MediaStorage {
  put(key: string, data: Buffer, contentType: string): Promise<{ url: string }>;
  // Lee un archivo ya guardado (por ejemplo, para recortarlo).
  get(key: string): Promise<Buffer>;
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
    async get(key) {
      return readFile(path.join(dir, key));
    },
    async remove(key) {
      await rm(path.join(dir, key), { force: true });
    },
  };
}

// Un fallo de Supabase Storage se informa con su motivo (lo que responde Storage,
// sin la clave), para poder corregir la configuración desde el panel: bucket
// inexistente o privado, clave equivocada, cuota llena. 503 (y no 502): la
// Function de Cloudflare cambia los 502 por la página «sin servidor».
async function falloDeStorage(accion: string, res: Response): Promise<ApiError> {
  const cuerpo = await res.text().catch(() => "");
  let motivo = cuerpo;
  try {
    const json = JSON.parse(cuerpo) as { message?: unknown; error?: unknown };
    motivo = String(json.message ?? json.error ?? cuerpo);
  } catch {
    // No era JSON: queda el texto tal cual.
  }
  motivo = motivo.replace(/\s+/g, " ").trim().slice(0, 200) || "sin detalle";
  return new ApiError(
    503,
    "STORAGE_FAILED",
    `El almacenamiento de imágenes (Supabase Storage) no pudo ${accion}: ${res.status} ${motivo}. Revisa en Supabase que exista el bucket público y que la clave del servidor sea la service_role o la secret key (sb_secret_…).`,
  );
}

async function pedir(fetchFn: typeof fetch, url: string, init: RequestInit) {
  try {
    return await fetchFn(url, init);
  } catch {
    throw new ApiError(
      503,
      "STORAGE_UNREACHABLE",
      "No se pudo conectar con el almacenamiento de imágenes (Supabase Storage). Revisa SUPABASE_URL en el servidor e intenta de nuevo.",
    );
  }
}

// Usa la API REST de Storage directamente (sin SDK). La clave del servidor solo vive
// en el servidor: nunca debe llegar al navegador. Va en las cabeceras que pide su
// tipo: una sb_secret_ como Bearer hace que Storage rechace todo («Invalid Compact JWS»).
export function supabaseStorage(
  config: { url: string; serviceRoleKey: string; bucket: string },
  fetchFn: typeof fetch = fetch,
): MediaStorage {
  const base = config.url.replace(/\/$/, "");
  const headers = cabecerasDeSupabase(config.serviceRoleKey);
  return {
    async put(key, data, contentType) {
      const res = await pedir(fetchFn, `${base}/storage/v1/object/${config.bucket}/${key}`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": contentType,
          "Cache-Control": "max-age=31536000",
          "x-upsert": "false",
        },
        body: new Uint8Array(data),
      });
      if (!res.ok) throw await falloDeStorage("guardar la imagen", res);
      return { url: `${base}/storage/v1/object/public/${config.bucket}/${key}` };
    },
    async get(key) {
      const res = await pedir(fetchFn, `${base}/storage/v1/object/${config.bucket}/${key}`, {
        headers,
      });
      if (!res.ok) throw await falloDeStorage("leer la imagen", res);
      return Buffer.from(await res.arrayBuffer());
    },
    async remove(key) {
      const res = await pedir(fetchFn, `${base}/storage/v1/object/${config.bucket}`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [key] }),
      });
      if (!res.ok) throw await falloDeStorage("borrar la imagen", res);
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
