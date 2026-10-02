import { z } from "zod";

// Texto enriquecido del editor del panel (TipTap).
//
// El servidor NO confía en el HTML que manda el navegador: valida el documento
// JSON contra este esquema (solo los nodos y marcas que ofrece la barra del
// editor) y genera el HTML él mismo, escapando todo. Así un <script>, un
// onerror= o un href="javascript:" no pueden llegar a la landing.

// --- Esquema del documento --------------------------------------------------

// Enlaces permitidos: http(s), correo, teléfono, rutas internas y anclas.
const hrefSchema = z
  .string()
  .trim()
  .max(2000)
  .regex(
    /^(https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+|tel:[+\d\s()-]+|\/[^\s<>"]*|#[\w-]+)$/i,
    "Enlace no válido. Usa una dirección https://, mailto:, tel: o una ruta del sitio.",
  );

// Imágenes: solo las subidas al propio sitio (/uploads/...) o a su almacenamiento https.
const srcSchema = z
  .string()
  .trim()
  .max(2000)
  .regex(/^(\/uploads\/[\w./-]+|https:\/\/[^\s<>"]+)$/, "Imagen no válida.");

const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  // z.object descarta los atributos extra de TipTap (target, rel, class).
  z.object({ type: z.literal("link"), attrs: z.object({ href: hrefSchema }) }),
]);

const textSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(20_000),
  marks: z.array(markSchema).max(3).optional(),
});
const hardBreakSchema = z.object({ type: z.literal("hardBreak") });
const inlineSchema = z.discriminatedUnion("type", [textSchema, hardBreakSchema]);
const inlineContent = z.array(inlineSchema).max(2000).optional();

export type InlineNode = z.infer<typeof inlineSchema>;

export type BlockNode =
  | { type: "paragraph"; content?: InlineNode[] }
  | { type: "heading"; attrs: { level: 2 | 3 | 4 }; content?: InlineNode[] }
  | { type: "bulletList"; content: ListItemNode[] }
  | { type: "orderedList"; attrs?: { start?: number }; content: ListItemNode[] }
  | { type: "blockquote"; content: BlockNode[] }
  | { type: "horizontalRule" }
  | { type: "image"; attrs: { src: string; alt: string; caption?: string | null } };

export interface ListItemNode {
  type: "listItem";
  content: BlockNode[];
}

const listItemSchema: z.ZodType<ListItemNode> = z.lazy(() =>
  z.object({ type: z.literal("listItem"), content: z.array(blockSchema).min(1).max(50) }),
);

const blockSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("paragraph"), content: inlineContent }),
    z.object({
      type: z.literal("heading"),
      // El H1 es el título de la página: en el cuerpo solo hay H2 a H4.
      attrs: z.object({ level: z.union([z.literal(2), z.literal(3), z.literal(4)]) }),
      content: inlineContent,
    }),
    z.object({ type: z.literal("bulletList"), content: z.array(listItemSchema).min(1).max(200) }),
    z.object({
      type: z.literal("orderedList"),
      attrs: z.object({ start: z.number().int().min(0).max(10_000).optional() }).optional(),
      content: z.array(listItemSchema).min(1).max(200),
    }),
    z.object({ type: z.literal("blockquote"), content: z.array(blockSchema).min(1).max(50) }),
    z.object({ type: z.literal("horizontalRule") }),
    z.object({
      type: z.literal("image"),
      attrs: z.object({
        src: srcSchema,
        // Puede llegar vacío: el análisis de accesibilidad lo informa como error claro.
        alt: z.string().trim().max(500).default(""),
        caption: z.string().trim().max(500).nullish(),
      }),
    }),
  ]),
);

export const docSchema = z.object({
  type: z.literal("doc"),
  content: z.array(blockSchema).max(2000).default([]),
});

export type Doc = z.infer<typeof docSchema>;

export const EMPTY_DOC: Doc = { type: "doc", content: [] };

// --- HTML -------------------------------------------------------------------

function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInline(nodos: InlineNode[] = []): string {
  return nodos
    .map((n) => {
      if (n.type === "hardBreak") return "<br>";
      let html = escapar(n.text);
      const marcas = n.marks ?? [];
      if (marcas.some((m) => m.type === "italic")) html = `<em>${html}</em>`;
      if (marcas.some((m) => m.type === "bold")) html = `<strong>${html}</strong>`;
      const link = marcas.find((m) => m.type === "link");
      if (link) {
        const href = link.attrs.href;
        const externo = /^https?:\/\//i.test(href);
        html = `<a href="${escapar(href)}"${externo ? ' rel="noopener noreferrer"' : ""}>${html}</a>`;
      }
      return html;
    })
    .join("");
}

function renderBlock(b: BlockNode): string {
  switch (b.type) {
    case "paragraph": {
      const html = renderInline(b.content);
      // Los párrafos vacíos no se publican: no deben usarse para dar espacio.
      return html.trim() ? `<p>${html}</p>` : "";
    }
    case "heading": {
      const html = renderInline(b.content);
      return html.trim() ? `<h${b.attrs.level}>${html}</h${b.attrs.level}>` : "";
    }
    case "bulletList":
      return `<ul>${b.content.map(renderListItem).join("")}</ul>`;
    case "orderedList": {
      const inicio = b.attrs?.start;
      const attr = inicio !== undefined && inicio !== 1 ? ` start="${inicio}"` : "";
      return `<ol${attr}>${b.content.map(renderListItem).join("")}</ol>`;
    }
    case "blockquote":
      return `<blockquote>${b.content.map(renderBlock).join("")}</blockquote>`;
    case "horizontalRule":
      return "<hr>";
    case "image": {
      const { src, alt, caption } = b.attrs;
      const img = `<img src="${escapar(src)}" alt="${escapar(alt)}" loading="lazy" decoding="async">`;
      return `<figure>${img}${caption ? `<figcaption>${escapar(caption)}</figcaption>` : ""}</figure>`;
    }
  }
}

function renderListItem(li: ListItemNode): string {
  return `<li>${li.content.map(renderBlock).join("")}</li>`;
}

export function renderDoc(doc: Doc): string {
  return doc.content.map(renderBlock).join("");
}

// --- Texto plano y accesibilidad -------------------------------------------

function textoInline(nodos: InlineNode[] = []): string {
  return nodos.map((n) => (n.type === "text" ? n.text : " ")).join("");
}

function* recorrer(bloques: BlockNode[]): Generator<BlockNode> {
  for (const b of bloques) {
    yield b;
    if (b.type === "blockquote") yield* recorrer(b.content);
    if (b.type === "bulletList" || b.type === "orderedList") {
      for (const li of b.content) yield* recorrer(li.content);
    }
  }
}

export function plainText(doc: Doc): string {
  const partes: string[] = [];
  for (const b of recorrer(doc.content)) {
    if (b.type === "paragraph" || b.type === "heading") partes.push(textoInline(b.content));
  }
  return partes
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function readingStats(doc: Doc) {
  const palabras = plainText(doc).split(/\s+/).filter(Boolean).length;
  return { palabras, minutosLectura: Math.max(1, Math.round(palabras / 200)) };
}

export interface A11yIssue {
  code: string;
  message: string;
}

const TEXTOS_GENERICOS = new Set([
  "aquí",
  "aqui",
  "clic aquí",
  "click aquí",
  "haz clic aquí",
  "pincha aquí",
  "ver más",
  "leer más",
  "más",
  "mas",
  "link",
  "enlace",
  "este enlace",
]);

// Revisa el documento antes de enviarlo a revisión o publicarlo.
// `errores` bloquean la publicación; `advertencias` se muestran pero no bloquean.
export function checkAccessibility(doc: Doc) {
  const errores: A11yIssue[] = [];
  const advertencias: A11yIssue[] = [];
  let imagen = 0;
  let nivelAnterior = 1; // el título de la página es el H1

  for (const b of recorrer(doc.content)) {
    if (b.type === "image") {
      imagen++;
      if (!b.attrs.alt.trim()) {
        errores.push({
          code: "IMAGEN_SIN_ALT",
          message: `La imagen ${imagen} no tiene texto alternativo. Describe qué muestra para quienes usan lector de pantalla.`,
        });
      }
    }
    if (b.type === "heading") {
      const texto = textoInline(b.content).trim();
      if (texto && b.attrs.level > nivelAnterior + 1) {
        advertencias.push({
          code: "SALTO_DE_TITULO",
          message: `El subtítulo «${texto.slice(0, 60)}» salta de H${nivelAnterior} a H${b.attrs.level}. Usa H${nivelAnterior + 1} para mantener la estructura.`,
        });
      }
      if (texto) nivelAnterior = b.attrs.level;
    }
    if (b.type === "paragraph" || b.type === "heading") {
      for (const n of b.content ?? []) {
        if (n.type !== "text" || !n.marks?.some((m) => m.type === "link")) continue;
        const texto = n.text.trim().toLowerCase();
        if (!texto) {
          errores.push({ code: "ENLACE_SIN_TEXTO", message: "Hay un enlace sin texto visible." });
        } else if (TEXTOS_GENERICOS.has(texto)) {
          advertencias.push({
            code: "ENLACE_GENERICO",
            message: `El enlace «${n.text.trim()}» no dice adónde lleva. Usa un texto descriptivo, por ejemplo «Ver el informe completo».`,
          });
        }
      }
    }
    if (b.type === "paragraph") {
      const palabras = textoInline(b.content).split(/\s+/).filter(Boolean).length;
      if (palabras > 150) {
        advertencias.push({
          code: "PARRAFO_LARGO",
          message: `Hay un párrafo de ${palabras} palabras. Divídelo para facilitar la lectura.`,
        });
      }
    }
  }
  if (!plainText(doc)) {
    errores.push({ code: "CUERPO_VACIO", message: "El cuerpo de la nota está vacío." });
  }
  return { errores, advertencias };
}

// --- Texto enriquecido de las secciones --------------------------------------

// Entra el documento (el html que mande el navegador se ignora) y sale el
// documento con su HTML generado aquí.
export const richTextSchema = z
  .object({ json: docSchema })
  .transform(({ json }) => ({ json, html: renderDoc(json) }));

export type RichText = z.output<typeof richTextSchema>;

// Construye un texto enriquecido de solo párrafos. Lo usa el seed para el contenido inicial.
export function richTextFromParagraphs(parrafos: string[]): RichText {
  const json: Doc = {
    type: "doc",
    content: parrafos.map((texto) => ({
      type: "paragraph",
      content: [{ type: "text", text: texto }],
    })),
  };
  return { json, html: renderDoc(json) };
}
