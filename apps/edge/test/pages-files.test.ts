import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { derivarPagina, PAGINA_404, PAGINA_SIN_SERVIDOR, rutaDe } from "../src/pages-files.ts";

const OFFLINE = readFileSync(
  path.resolve(import.meta.dirname, "../../web/public/offline.html"),
  "utf-8",
);

describe("páginas derivadas de offline.html", () => {
  it.each([PAGINA_404, PAGINA_SIN_SERVIDOR])(
    "$archivo cambia los textos y conserva el diseño",
    (pagina) => {
      const html = derivarPagina(OFFLINE, pagina);
      expect(html).toContain(`<title>${pagina.titulo} · SIGNAL</title>`);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toContain(`<h1>${pagina.encabezado}</h1>`);
      expect(html).toContain(`<a href="${pagina.enlace.href}">${pagina.enlace.texto}</a>`);
      expect(html).not.toContain("sin conexión");
      expect(html).toContain('<html lang="es">');
      expect(html).toContain('<meta name="robots" content="noindex" />');
      expect(html).toContain("min-height: 2.75rem");
    },
  );

  it("escapa el HTML de los textos", () => {
    const html = derivarPagina(OFFLINE, { ...PAGINA_404, encabezado: "<script>x</script>" });
    expect(html).toContain("<h1>&lt;script&gt;x&lt;/script&gt;</h1>");
  });

  it("falla con un mensaje claro si offline.html cambió de estructura", () => {
    expect(() => derivarPagina("<html><title>x</title></html>", PAGINA_404)).toThrow(
      /offline.html cambió: se esperaba un solo <h1>/,
    );
  });

  it("la ruta de cada página es la que usa Pages, sin .html", () => {
    expect(rutaDe(PAGINA_SIN_SERVIDOR)).toBe("/sin-servidor");
  });
});
