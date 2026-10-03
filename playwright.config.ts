import { defineConfig, devices } from "@playwright/test";
import { BASE } from "./e2e/config.mjs";

// Pruebas de punta a punta de la landing y el panel en navegador real, con axe.
//   npm run build -w apps/web && npm run e2e
// Con PW_CANAL=chrome usa el Chrome instalado en vez de descargar Chromium.

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    locale: "es-CL",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: process.env.PW_CANAL || undefined },
    },
  ],
  webServer: {
    command: "node e2e/servidor.mjs",
    url: `${BASE}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
  },
});
