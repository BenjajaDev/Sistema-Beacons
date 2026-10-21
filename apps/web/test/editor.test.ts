import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { checkAccessibility, docSchema, renderDoc } from "@server-rich-text";
import { adaptarHtmlPegado, crearExtensiones } from "../src/admin/editor/extensiones";

// El editor del panel y el servidor deben hablar el mismo idioma: todo lo que el
// editor produce tiene que pasar el esquema del servidor, y lo que el servidor no
// acepta (código, subrayado, H1...) el editor no debe producirlo.

let editor: Editor | undefined;
afterEach(() => editor?.destroy());

function editorCon(html: string, barra: "completa" | "reducida" = "completa") {
  editor = new Editor({ extensions: crearExtensiones(barra, ""), content: html });
  return editor.getJSON();
}

describe("compatibilidad del editor con el servidor", () => {
  it("todo el formato de la barra completa pasa el esquema del servidor", () => {
    const json = editorCon(`
      <h2>Contexto</h2><h3>Detalle</h3><h4>Nota</h4>
      <p>Texto con <strong>negrita</strong>, <em>cursiva</em> y un
        <a href="https://signal.cl/informe" target="_blank" class="x">enlace</a>.<br>Otra línea.</p>
      <ul><li><p>uno</p></li></ul>
      <ol start="3"><li><p>tres</p><ul><li><p>anidado</p></li></ul></li></ol>
      <blockquote><p>Una cita</p></blockquote>
      <hr>
      <figure><img src="/uploads/2026/10/a.webp" alt="Mapa del edificio"><figcaption>Planta baja</figcaption></figure>
      <p><a href="mailto:hola@signal.cl">correo</a> y <a href="tel:+56912345678">teléfono</a></p>
    `);
    const r = docSchema.safeParse(json);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    const html = renderDoc(r.data!);
    expect(html).toContain("<h2>Contexto</h2>");
    expect(html).toContain('<ol start="3">');
    expect(html).toContain('<img src="/uploads/2026/10/a.webp" alt="Mapa del edificio"');
    expect(html).toContain("<figcaption>Planta baja</figcaption>");
    expect(checkAccessibility(r.data!).errores).toEqual([]);
  });

  it("descarta lo que el servidor no acepta (código, subrayado, tachado, scripts)", () => {
    const json = editorCon(`
      <p><code>codigo</code> <u>subrayado</u> <s>tachado</s> normal</p>
      <pre><code>bloque</code></pre>
      <script>alert(1)</script>
      <p><a href="javascript:alert(1)">malo</a></p>
      <iframe src="https://x"></iframe>
    `);
    const r = docSchema.safeParse(json);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    const html = renderDoc(r.data!);
    expect(html).not.toMatch(/<(code|u|s|script|iframe|pre)\b/);
    expect(html).not.toContain("javascript:");
  });

  it("al pegar, un H1 pasa a H2", () => {
    const json = editorCon(adaptarHtmlPegado("<h1>Título pegado</h1><p>x</p>"));
    expect(renderDoc(docSchema.parse(json))).toContain("<h2>Título pegado</h2>");
  });

  it("la barra reducida (textos de secciones) no produce títulos, citas ni imágenes", () => {
    const json = editorCon(
      '<h2>Título</h2><blockquote><p>cita</p></blockquote><img src="/uploads/a.webp" alt="x"><p><strong>ok</strong></p>',
      "reducida",
    );
    const html = renderDoc(docSchema.parse(json));
    expect(html).not.toMatch(/<(h2|blockquote|img|figure)\b/);
    expect(html).toContain("<strong>ok</strong>");
  });

  it("una imagen sin texto alternativo se guarda, pero la revisión de accesibilidad la bloquea", () => {
    const json = editorCon('<p>texto</p><img src="/uploads/a.webp">');
    const doc = docSchema.parse(json);
    expect(checkAccessibility(doc).errores.map((e) => e.code)).toEqual(["IMAGEN_SIN_ALT"]);
  });
});
