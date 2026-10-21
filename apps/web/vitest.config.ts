import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "src/shared"),
      "@server-theme": path.resolve(import.meta.dirname, "../../server/src/content/theme.ts"),
      "@server-footer": path.resolve(import.meta.dirname, "../../server/src/content/footer.ts"),
      // Solo para tests: validar la salida del editor con el esquema del servidor.
      "@server-rich-text": path.resolve(
        import.meta.dirname,
        "../../server/src/content/rich-text.ts",
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    css: false,
  },
});
