import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "@shared/api";

const responder = (status: number, cuerpo?: unknown) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status }),
    );

afterEach(() => vi.restoreAllMocks());

describe("apiFetch", () => {
  it("devuelve el JSON y manda el cuerpo como JSON", async () => {
    const espia = responder(200, { ok: true });
    await expect(apiFetch("/api/x", { method: "POST", body: { a: 1 } })).resolves.toEqual({
      ok: true,
    });
    const [, init] = espia.mock.calls[0]!;
    expect(init?.body).toBe('{"a":1}');
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("convierte un 400 del servidor en ApiError con los errores por campo", async () => {
    responder(400, {
      error: "Revisa los campos marcados.",
      code: "VALIDATION",
      campos: { correo: "Correo inválido." },
    });
    const err = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 400,
      code: "VALIDATION",
      message: "Revisa los campos marcados.",
    });
    expect(err.campos).toEqual({ correo: "Correo inválido." });
  });

  it("explica qué hacer si no hay conexión", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiFetch("/api/x")).rejects.toMatchObject({
      code: "NETWORK",
      message: expect.stringContaining("Revisa tu conexión"),
    });
  });

  it("da un mensaje útil si el servidor falla sin JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Bad gateway", { status: 502 }));
    await expect(apiFetch("/api/x")).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("Intenta de nuevo"),
    });
  });

  it("un 204 no intenta leer JSON", async () => {
    responder(204);
    await expect(apiFetch("/api/x", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
