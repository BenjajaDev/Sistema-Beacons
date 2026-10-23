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

  it("si no puede conectarse, lo dice", async () => {
    const storage = supabaseStorage(CONFIG, async () => {
      throw new TypeError("fetch failed");
    });
    const err = await storage.get("a.webp").catch((e) => e);
    expect(err).toMatchObject({ status: 503, code: "STORAGE_UNREACHABLE" });
  });
});
