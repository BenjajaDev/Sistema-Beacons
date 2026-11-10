import { describe, expect, it } from "vitest";
import { publicSectionImages, resolveSectionImages } from "../src/content/section-images.js";
import { ApiError } from "../src/http/errors.js";

const A = "0e4f3c1a-5b7d-4a2e-9c8f-1d2b3a4c5e6f";
const B = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

// Biblioteca falsa: solo existe la imagen A.
const biblioteca = {
  media: {
    findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in
        .filter((id) => id === A)
        .map((id) => ({ id, url: "/uploads/2026/10/a.webp", width: 800, height: 600 })),
  },
};

describe("resolveSectionImages", () => {
  it("agrega URL y tamaño desde la biblioteca, sin creer lo que manda el navegador", async () => {
    const contenido = {
      titulo: "Hola",
      imagen: { mediaId: A, alt: "Puerta", decorativa: false, url: "https://malo.example/x.png" },
      pasos: [{ titulo: "1", texto: "t" }],
    };
    expect(await resolveSectionImages(biblioteca, contenido)).toEqual({
      titulo: "Hola",
      imagen: {
        mediaId: A,
        url: "/uploads/2026/10/a.webp",
        width: 800,
        height: 600,
        alt: "Puerta",
        decorativa: false,
      },
      pasos: [{ titulo: "1", texto: "t" }],
    });
  });

  it("una imagen decorativa queda con alt vacío", async () => {
    const r = await resolveSectionImages(biblioteca, {
      imagen: { mediaId: A, alt: "sobra", decorativa: true },
    });
    expect(r.imagen).toMatchObject({ alt: "", decorativa: true });
  });

  it("una imagen que ya no existe es un error en su campo, con la ruta completa", async () => {
    const intento = resolveSectionImages(biblioteca, {
      pasos: [
        { titulo: "1" },
        { titulo: "2", imagen: { mediaId: B, alt: "x", decorativa: false } },
      ],
    });
    await expect(intento).rejects.toBeInstanceOf(ApiError);
    await expect(intento).rejects.toMatchObject({
      status: 400,
      extra: { campos: { "pasos.1.imagen.mediaId": expect.any(String) } },
    });
  });

  it("sin imágenes no consulta la biblioteca", async () => {
    const sinUso = { media: { findMany: () => Promise.reject(new Error("no debería llamarse")) } };
    expect(await resolveSectionImages(sinUso, { titulo: "x" })).toEqual({ titulo: "x" });
  });
});

describe("publicSectionImages", () => {
  it("entrega a la landing solo url, tamaño y alt", () => {
    expect(
      publicSectionImages({
        items: [
          {
            titulo: "x",
            imagen: { mediaId: A, url: "/u.webp", width: 1, height: 2, alt: "", decorativa: true },
          },
        ],
      }),
    ).toEqual({
      items: [{ titulo: "x", imagen: { url: "/u.webp", width: 1, height: 2, alt: "" } }],
    });
  });
});
