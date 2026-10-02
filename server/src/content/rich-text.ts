import { z } from "zod";

// Texto enriquecido tal como lo guarda el editor del panel (TipTap):
// `json` es el documento y la fuente de verdad; `html` es su versión saneada,
// generada en el servidor, que es lo único que muestra la landing.
export const richTextSchema = z.object({
  json: z.object({ type: z.literal("doc"), content: z.array(z.json()) }),
  html: z.string(),
});

export type RichText = z.infer<typeof richTextSchema>;

function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Construye un texto enriquecido de solo párrafos. Lo usa el seed para el
// contenido inicial; el panel genera el resto desde el editor.
export function richTextFromParagraphs(parrafos: string[]): RichText {
  return {
    json: {
      type: "doc",
      content: parrafos.map((texto) => ({
        type: "paragraph",
        content: [{ type: "text", text: texto }],
      })),
    },
    html: parrafos.map((texto) => `<p>${escaparHtml(texto)}</p>`).join(""),
  };
}
