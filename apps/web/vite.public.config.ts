import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { shared } from "./vite.shared.ts";

// Landing pública → dist/public. NO debe importar nada de src/admin
// (lo impide ESLint y lo verifica scripts/check-public-bundle.mjs).
//
// La PWA (manifest + service worker) existe SOLO en este build: el panel no está
// en el precache, ni en el manifest, ni en las rutas que intercepta el service worker.

export default defineConfig({
  ...shared,
  plugins: [
    ...shared.plugins,
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      includeAssets: ["offline.html", "icons/favicon-48.png", "icons/apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "SIGNAL · Navegación interior accesible",
        short_name: "SIGNAL",
        description:
          "Navegación interior accesible con beacons Bluetooth para personas con discapacidad visual.",
        lang: "es",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#FFF4EB",
        theme_color: "#004AAD",
        categories: ["accessibility", "navigation"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,woff2,png,html}"],
        // index.html se sirve con datos y tema inyectados por el servidor: las
        // navegaciones van primero a la red (abajo), no al shell precargado.
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Páginas de la landing: red primero; sin red, la última versión visitada;
            // si nunca se visitó, la página offline. Es una lista de rutas permitidas:
            // cualquier otra navegación (incluida la del panel) va directo a la red.
            // OJO: Workbox copia esta función como texto dentro de sw.js, así que no
            // puede usar variables de este archivo: la regex va literal.
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" &&
              /^\/(?:nosotros|noticias(?:\/[a-z0-9-]+)?|contacto)?\/?$/.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "paginas",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40 },
              precacheFallback: { fallbackURL: "/offline.html" },
            },
          },
          {
            urlPattern: ({ url }) =>
              /^\/api\/public\/(?:site|pages\/|team|collaborators)/.test(url.pathname),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "api-contenido", expiration: { maxEntries: 20 } },
          },
          {
            // Noticias publicadas: disponibles offline una vez leídas.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/public/news"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-noticias",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 3600 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/uploads/"),
            handler: "CacheFirst",
            options: {
              cacheName: "imagenes",
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  base: "/",
  publicDir: "public",
  server: { ...shared.server, port: 5173 },
  build: {
    ...shared.build,
    outDir: "dist/public",
    rolldownOptions: { input: "index.html" },
  },
});
