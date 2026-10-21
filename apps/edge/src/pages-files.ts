// Páginas que se agregan al build de la landing solo para Cloudflare Pages. Se
// derivan de offline.html para compartir su diseño (colores, foco, objetivos de
// 44 px) sin duplicarlo.

export interface PaginaDerivada {
  archivo: string;
  titulo: string;
  encabezado: string;
  texto: string;
  enlace: { href: string; texto: string };
}

// Pages la devuelve cuando un archivo estático no existe. Su sola presencia
// desactiva el modo SPA de Pages, que respondería index.html con 200 a cualquier
// ruta desconocida. La Function reenvía esos casos al servidor, así que en la
// práctica no se muestra.
export const PAGINA_404: PaginaDerivada = {
  archivo: "404.html",
  titulo: "Página no encontrada",
  encabezado: "Página no encontrada",
  texto: "La dirección que abriste no existe o cambió.",
  enlace: { href: "/", texto: "Ir al inicio" },
};

// La Function la responde con 503 cuando el servidor no contesta.
export const PAGINA_SIN_SERVIDOR: PaginaDerivada = {
  archivo: "sin-servidor.html",
  titulo: "Servicio no disponible",
  encabezado: "SIGNAL no responde en este momento",
  texto: "Tenemos un problema con el servidor. Vuelve a intentarlo en unos minutos.",
  // href vacío: recarga la misma dirección.
  enlace: { href: "", texto: "Reintentar" },
};

// Pages sirve cada archivo .html sin la extensión (sin-servidor.html → /sin-servidor).
export const rutaDe = (pagina: PaginaDerivada) => `/${pagina.archivo.replace(/\.html$/, "")}`;

function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reemplazarUnaVez(html: string, patron: RegExp, nuevo: string, que: string) {
  const coincidencias = html.match(new RegExp(patron.source, `${patron.flags}g`))?.length ?? 0;
  if (coincidencias !== 1) {
    throw new Error(
      `offline.html cambió: se esperaba un solo ${que} y hay ${coincidencias}. Ajusta apps/edge/src/pages-files.ts.`,
    );
  }
  return html.replace(patron, () => nuevo);
}

export function derivarPagina(plantilla: string, pagina: PaginaDerivada): string {
  let html = plantilla;
  html = reemplazarUnaVez(
    html,
    /<title>[^<]*<\/title>/,
    `<title>${escaparHtml(pagina.titulo)} · SIGNAL</title>`,
    "<title>",
  );
  html = reemplazarUnaVez(
    html,
    /<h1>[\s\S]*?<\/h1>/,
    `<h1>${escaparHtml(pagina.encabezado)}</h1>`,
    "<h1>",
  );
  html = reemplazarUnaVez(html, /<p>[\s\S]*?<\/p>/, `<p>${escaparHtml(pagina.texto)}</p>`, "<p>");
  html = reemplazarUnaVez(
    html,
    /(?:<!--[\s\S]*?-->\s*)?<a href="[^"]*">[\s\S]*?<\/a>/,
    `<a href="${escaparHtml(pagina.enlace.href)}">${escaparHtml(pagina.enlace.texto)}</a>`,
    "enlace",
  );
  return html;
}
