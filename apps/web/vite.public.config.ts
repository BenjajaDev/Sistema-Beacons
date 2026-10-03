import { defineConfig } from "vite";
import { shared } from "./vite.shared.ts";

// Landing pública → dist/public. NO debe importar nada de src/admin
// (lo impide ESLint y lo verifica scripts/check-public-bundle.mjs).
export default defineConfig({
  ...shared,
  base: "/",
  publicDir: "public",
  server: { ...shared.server, port: 5173 },
  build: {
    ...shared.build,
    outDir: "dist/public",
    rolldownOptions: { input: "index.html" },
  },
});
