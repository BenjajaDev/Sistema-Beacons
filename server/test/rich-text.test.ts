import { describe, expect, it } from "vitest";
import {
  checkAccessibility,
  docSchema,
  readingStats,
  renderDoc,
  richTextSchema,
} from "../src/content/rich-text.js";

const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, marks?: unknown[]) => ({ type: "text", text, ...(marks && { marks }) });
const doc = (...content: unknown[]) => docSchema.parse({ type: "doc", content });

describe("renderDoc", () => {
  it("genera HTML semántico para los nodos de la barra", () => {
    const html = renderDoc(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [t("Título")] },
        p(t("Hola "), t("fuerte", [{ type: "bold" }]), t(" y "), t("suave", [{ type: "italic" }])),
        { type: "bulletList", content: [{ type: "listItem", content: [p(t("uno"))] }] },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [{ type: "listItem", content: [p(t("tres"))] }],
        },
        { type: "blockquote", content: [p(t("cita"))] },
        { type: "horizontalRule" },
        {
          type: "image",
          attrs: {
            src: "/uploads/2026/10/a.webp",
            alt: "Mapa del edificio",
            caption: "Planta baja",
          },
        },
      ),
    );
    expect(html).toBe(
      "<h2>Título</h2>" +
        "<p>Hola <strong>fuerte</strong> y <em>suave</em></p>" +
        "<ul><li><p>uno</p></li></ul>" +
        '<ol start="3"><li><p>tres</p></li></ol>' +
        "<blockquote><p>cita</p></blockquote>" +
        "<hr>" +
        '<figure><img src="/uploads/2026/10/a.webp" alt="Mapa del edificio" loading="lazy" decoding="async"><figcaption>Planta baja</figcaption></figure>',
    );
  });

  it("escapa el texto: un <script> escrito en el editor se muestra como texto", () => {
    const html = renderDoc(doc(p(t('<script>alert("x")</script><img src=x onerror=alert(1)>'))));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("los enlaces externos llevan rel=noopener y no se abren en otra pestaña", () => {
    const html = renderDoc(
      doc(
        p(
          t("informe", [{ type: "link", attrs: { href: "https://ejemplo.cl", target: "_blank" } }]),
        ),
      ),
    );
    expect(html).toBe('<p><a href="https://ejemplo.cl" rel="noopener noreferrer">informe</a></p>');
  });

  it("omite párrafos vacíos (no se usan para dar espacio)", () => {
    expect(renderDoc(doc(p(), p(t("a")), p()))).toBe("<p>a</p>");
  });
});

describe("docSchema rechaza lo que el editor no ofrece", () => {
  it.each([
    ["href javascript:", p(t("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))],
    ["href data:", p(t("x", [{ type: "link", attrs: { href: "data:text/html,<script>" } }]))],
    ["H1 en el cuerpo", { type: "heading", attrs: { level: 1 }, content: [t("x")] }],
    ["nodo desconocido", { type: "iframe", attrs: { src: "https://x" } }],
    ["bloque de código", { type: "codeBlock", content: [t("x")] }],
    ["marca no permitida", p(t("x", [{ type: "underline" }]))],
    ["imagen externa por http", { type: "image", attrs: { src: "http://x.cl/a.png", alt: "a" } }],
    ["imagen con javascript:", { type: "image", attrs: { src: "javascript:alert(1)", alt: "a" } }],
  ])("%s", (_n, nodo) => {
    expect(docSchema.safeParse({ type: "doc", content: [nodo] }).success).toBe(false);
  });

  it("descarta atributos extra de TipTap (class, style, on*)", () => {
    const d = doc(
      p(t("x", [{ type: "link", attrs: { href: "/a", class: "x", onclick: "alert(1)" } }])),
    );
    expect(renderDoc(d)).toBe('<p><a href="/a">x</a></p>');
  });
});

describe("checkAccessibility", () => {
  it("bloquea imágenes sin texto alternativo", () => {
    const r = checkAccessibility(
      doc(p(t("texto")), { type: "image", attrs: { src: "/uploads/a.webp", alt: " " } }),
    );
    expect(r.errores.map((e) => e.code)).toEqual(["IMAGEN_SIN_ALT"]);
  });

  it("bloquea un cuerpo vacío", () => {
    expect(checkAccessibility(doc(p())).errores.map((e) => e.code)).toEqual(["CUERPO_VACIO"]);
  });

  it("advierte saltos de nivel en los subtítulos", () => {
    const r = checkAccessibility(
      doc({ type: "heading", attrs: { level: 3 }, content: [t("Sin H2 antes")] }, p(t("x"))),
    );
    expect(r.errores).toEqual([]);
    expect(r.advertencias[0]?.code).toBe("SALTO_DE_TITULO");
    expect(r.advertencias[0]?.message).toContain("H1 a H3");
  });

  it("advierte enlaces con texto genérico", () => {
    const r = checkAccessibility(
      doc(p(t("Haz clic aquí", [{ type: "link", attrs: { href: "/x" } }]))),
    );
    expect(r.advertencias.map((a) => a.code)).toEqual(["ENLACE_GENERICO"]);
  });

  it("una nota bien construida no tiene observaciones", () => {
    const r = checkAccessibility(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [t("Contexto")] },
        p(
          t("Texto con un "),
          t("informe completo", [{ type: "link", attrs: { href: "/informe" } }]),
        ),
        { type: "image", attrs: { src: "/uploads/a.webp", alt: "Persona usando la app" } },
      ),
    );
    expect(r).toEqual({ errores: [], advertencias: [] });
  });
});

it("calcula palabras y minutos de lectura", () => {
  const palabras = Array.from({ length: 400 }, () => "palabra").join(" ");
  expect(readingStats(doc(p(t(palabras))))).toEqual({ palabras: 400, minutosLectura: 2 });
});

it("richTextSchema ignora el HTML del navegador y lo regenera", () => {
  const r = richTextSchema.parse({
    json: { type: "doc", content: [p(t("hola"))] },
    html: "<script>x</script>",
  });
  expect(r.html).toBe("<p>hola</p>");
});
