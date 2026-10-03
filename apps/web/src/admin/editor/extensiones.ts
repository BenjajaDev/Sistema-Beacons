import Image from "@tiptap/extension-image";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";

// Extensiones del editor. Deben producir SOLO lo que acepta el servidor
// (server/src/content/rich-text.ts): párrafos, H2–H4, negrita, cursiva, enlaces,
// listas, citas, separador, saltos de línea e imágenes con texto alternativo.
// Un test (test/editor.test.ts) valida la salida contra ese esquema.

export type Barra = "completa" | "reducida";

// Imagen como bloque, con pie de foto. Se guarda como nodo "image" con src, alt y caption.
export const Figura = Image.extend({
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: null },
    };
  },
  // Reconoce <figure> con su pie (al pegar o copiar entre notas) y <img> suelta.
  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (el) => {
          const img = el.querySelector("img");
          if (!img?.getAttribute("src")) return false;
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt") ?? "",
            caption: el.querySelector("figcaption")?.textContent?.trim() || null,
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs: (el) => ({ src: el.getAttribute("src"), alt: el.getAttribute("alt") ?? "" }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { caption, ...img } = HTMLAttributes as {
      caption?: string | null;
      src: string;
      alt: string;
    };
    return caption
      ? ["figure", {}, ["img", img], ["figcaption", {}, caption]]
      : ["figure", {}, ["img", img]];
  },
}).configure({ inline: false, allowBase64: false });

export function crearExtensiones(barra: Barra, placeholder: string) {
  const completa = barra === "completa";
  return [
    StarterKit.configure({
      // El H1 es el título de la página.
      heading: completa ? { levels: [2, 3, 4] } : false,
      blockquote: completa ? {} : false,
      horizontalRule: completa ? {} : false,
      // Fuera de la barra (no las acepta el servidor): código, tachado y subrayado
      // (el subrayado se confunde con un enlace).
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      trailingNode: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["mailto", "tel"],
        HTMLAttributes: { rel: null, target: null, class: null },
      },
    }),
    ...(completa ? [Figura] : []),
    Placeholder.configure({ placeholder }),
    CharacterCount,
  ];
}

// Mismas reglas que el servidor para los enlaces.
export const HREF_VALIDO =
  /^(https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+|tel:[+\d\s()-]+|\/[^\s<>"]*|#[\w-]+)$/i;

// Al pegar desde Word o Google Docs: un H1 pasa a H2 (el H1 es el título de la página).
export function adaptarHtmlPegado(html: string) {
  return html.replace(/<(\/?)h1(\s|>)/gi, "<$1h2$2");
}
