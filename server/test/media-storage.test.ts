import { describe, expect, it } from "vitest";
import { ApiError } from "../src/http/errors.js";
import { supabaseStorage } from "../src/services/media-storage.js";

const CONFIG = {
  url: "https://proyecto.supabase.co",
  serviceRoleKey: "clave-de-servicio-de-prueba-123",
  bucket: "media",
};
const respuesta = (status: number, cuerpo: string) => async () => new Response(cuerpo, { status });

describe("almacenamiento en Supabase", () => {
  it("guarda y devuelve la URL pública del bucket", async () => {
    const storage = supabaseStorage(CONFIG, respuesta(200, "{}"));
    expect(await storage.put("a/b.webp", Buffer.from("x"), "image/webp")).toEqual({
      url: "https://proyecto.supabase.co/storage/v1/object/public/media/a/b.webp",
    });
  });

  it("si Storage rechaza la imagen, informa su motivo con un 503 y sin la clave", async () => {
    const storage = supabaseStorage(
      CONFIG,
      respuesta(404, JSON.stringify({ statusCode: "404", error: "Bucket not found" })),
    );
    const err = await storage.put("a.webp", Buffer.from("x"), "image/webp").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(503);
    expect(err.code).toBe("STORAGE_FAILED");
    expect(err.message).toContain("404 Bucket not found");
    expect(err.message).not.toContain(CONFIG.serviceRoleKey);
  });

  it("con una secret key (sb_secret_) no envía Authorization: no es un JWT", async () => {
    const enviadas: Headers[] = [];
    const clave = "sb_secret_clave-de-prueba-0123456789";
    const storage = supabaseStorage({ ...CONFIG, serviceRoleKey: clave }, async (_url, init) => {
      enviadas.push(new Headers(init?.headers));
      return new Response("{}", { status: 200 });
    });
    await storage.put("a.webp", Buffer.from("x"), "image/webp");
    await storage.get("a.webp").catch(() => undefined);
    await storage.remove("a.webp");
    expect(enviadas).toHaveLength(3);
    for (const h of enviadas) {
      expect(h.get("apikey")).toBe(clave);
      expect(h.has("Authorization")).toBe(false);
    }
  });

  it("con una clave que no puede escribir, explica el motivo sin llamar a Storage", async () => {
    let llamadas = 0;
    const storage = supabaseStorage(
      { ...CONFIG, serviceRoleKey: "sb_publishable_clave-0123456789" },
      async () => {
        llamadas++;
        return new Response("{}");
      },
    );
    const err = await storage.put("a.webp", Buffer.from("x"), "image/webp").catch((e) => e);
    expect(err).toMatchObject({ status: 503, code: "STORAGE_MISCONFIGURED" });
    expect(err.message).toContain("publishable");
    expect(llamadas).toBe(0);
  });

  it("si no puede conectarse, lo dice", async () => {
    const storage = supabaseStorage(CONFIG, async () => {
      throw new TypeError("fetch failed");
    });
    const err = await storage.get("a.webp").catch((e) => e);
    expect(err).toMatchObject({ status: 503, code: "STORAGE_UNREACHABLE" });
  });
});
