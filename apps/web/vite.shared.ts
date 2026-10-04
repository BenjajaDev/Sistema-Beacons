import { readFileSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin, UserConfig } from "vite";

// Configuración común de los dos builds (landing y panel). Cada uno tiene su
// propio archivo de config y su propia carpeta de salida: así ningún chunk del
// panel puede terminar en el bundle público.

const API = process.env.SIGNAL_API ?? "http://127.0.0.1:3000";
const RAIZ = import.meta.dirname;

// theme-init.js aplica el tema y el tamaño de texto guardados antes del primer
// pintado. Va como script externo y síncrono porque la CSP prohíbe scripts inline.
function themeInit(): Plugin {
  const archivo = path.join(RAIZ, "src/shared/theme/theme-init.js");
  return {
    name: "signal-theme-init",
    configureServer(server) {
      server.middlewares.use("/theme-init.js", (_req, res) => {
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.end(readFileSync(archivo));
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "theme-init.js",
        source: readFileSync(archivo, "utf-8"),
      });
    },
  };
}

export const shared = {
  plugins: [react(), themeInit()],
  resolve: {
    alias: { "@shared": path.join(RAIZ, "src/shared") },
  },
  server: {
    // En desarrollo la API y las imágenes las sirve Express (npm run dev en la raíz).
    // changeOrigin en false: la forma corta ("/api": API) reescribe Host a la API, y
    // el control de origen del servidor rechazaría el login (Origin ≠ Host).
    proxy: {
      "/api": { target: API, changeOrigin: false },
      "/uploads": { target: API, changeOrigin: false },
    },
  },
  build: {
    target: "es2022",
    // Sin source maps: revelarían rutas y código fuente.
    sourcemap: false,
    emptyOutDir: true,
  },
} satisfies UserConfig;
