import { z } from "zod";

// Imagen de la biblioteca. Quien edita envía el id, el texto alternativo y si es
// decorativa; el servidor agrega la URL y el tamaño al guardar (section-images.ts).
// Sin texto alternativo, solo se acepta si se marca como decorativa (WCAG 1.1.1).
export const imagenSchema = z
  .object({
    mediaId: z.uuid("Elige una imagen."),
    alt: z.string().trim().max(300).default(""),
    decorativa: z.boolean().default(false),
  })
  .refine((i) => i.decorativa || i.alt.length > 0, {
    path: ["alt"],
    message: "Describe la imagen (texto alternativo) o márcala como decorativa.",
  });
