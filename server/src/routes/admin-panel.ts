import { readFile } from "node:fs/promises";
import path from "node:path";
import express, { Router } from "express";

// Sirve el panel (build de admin.html) SOLO bajo /<ADMIN_PATH>. La ruta no está en
// ningún bundle: el HTML se sirve con <base href> inyectado aquí, así que el mismo
// build funciona con cualquier ADMIN_PATH.
//
// Fuera de esa ruta el panel no existe: /admin, /login, /panel... responden 404.
export function adminPanel({
  adminPath,
  distDir,
  getThemeCss,
}: {
  adminPath: string;
  distDir: string;
  // CSS de Identidad visual (colores y fuentes) para inyectar antes del primer pintado.
  getThemeCss?: () => Promise<string | null>;
}) {
  const base = `/${adminPath}`;
  // Sensible a mayúsculas: /<ADMIN_PATH> en otra capitalización es otra ruta (404).
  const router = Router({ caseSensitive: true, strict: false });

  router.use(base, (_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });

  async function servirHtml(res: express.Response) {
    let html: string;
    try {
      html = await readFile(path.join(distDir, "admin.html"), "utf-8");
    } catch {
      res
        .status(503)
        .type("text/plain; charset=utf-8")
        .send("El panel no está compilado. Ejecuta `npm run build` y reinicia el servidor.");
      return;
    }
    const tema = (await getThemeCss?.()) ?? "";
    const cabecera =
      `<base href="${base}/">` +
      '<meta name="robots" content="noindex, nofollow">' +
      (tema ? `<style id="tema">${tema}</style>` : "");
    res
      .setHeader("Cache-Control", "no-store")
      .type("html")
      .send(html.replace(/<head(\s[^>]*)?>/i, (m) => m + cabecera));
  }

  // El HTML (y cualquier ruta del SPA sin extensión) siempre pasa por servirHtml.
  router.get([base, `${base}/admin.html`], (_req, res) => servirHtml(res));

  router.use(
    base,
    express.static(distDir, {
      index: false,
      fallthrough: true,
      setHeaders: (res, archivo) => {
        // Los assets llevan hash en el nombre: se pueden cachear para siempre.
        if (archivo.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  router.get(`${base}/*rutaSpa`, (req, res, next) => {
    // Un archivo con extensión que no existe es un 404, no el HTML del panel.
    if (path.extname(req.path)) return next();
    return servirHtml(res);
  });

  return router;
}
