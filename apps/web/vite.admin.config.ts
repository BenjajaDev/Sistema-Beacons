import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { shared } from "./vite.shared.ts";

// Panel → dist/admin. Base relativa: Express lo sirve bajo /<ADMIN_PATH> e inyecta
// <base href>, así que el build no conoce (ni filtra) la ruta secreta.

// En desarrollo, cualquier ruta del panel (/noticias, /beacons...) devuelve admin.html.
function spaFallback(): Plugin {
  return {
    name: "signal-admin-spa",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const esPagina = req.method === "GET" && req.headers.accept?.includes("text/html");
        if (esPagina && !path.extname(req.url ?? "")) req.url = "/admin.html";
        next();
      });
    },
  };
}

export default defineConfig({
  ...shared,
  plugins: [...shared.plugins, spaFallback()],
  base: "./",
  publicDir: false,
  resolve: {
    alias: {
      ...shared.resolve.alias,
      // Paleta, contraste y fuentes: misma fuente de verdad que el servidor.
      "@server-theme": path.resolve(import.meta.dirname, "../../server/src/content/theme.ts"),
    },
  },
  server: { ...shared.server, port: 5174, open: "/admin.html" },
  build: {
    ...shared.build,
    outDir: "dist/admin",
    rolldownOptions: { input: "admin.html" },
  },
});
