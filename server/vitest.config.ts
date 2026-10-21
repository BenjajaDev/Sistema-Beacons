import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env: en CI las variables vienen del entorno.
}

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    // Las pruebas de integración comparten una base de datos: sin paralelismo entre archivos.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
