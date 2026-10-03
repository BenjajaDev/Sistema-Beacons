// Lighthouse CI: rendimiento y accesibilidad de la landing en perfil móvil.
//   npm run build -w apps/web && npm run lighthouse && node e2e/resumen-lighthouse.mjs
// Umbrales del proyecto: rendimiento ≥ 90 y accesibilidad ≥ 95.
// (La instalabilidad de la PWA se verifica en e2e/pwa.spec.ts: Lighthouse ya no
// tiene categoría PWA.)

const BASE = "http://localhost:3100";

module.exports = {
  ci: {
    collect: {
      startServerCommand: "node e2e/servidor.mjs",
      startServerReadyPattern: "Servidor de pruebas listo",
      startServerReadyTimeout: 120000,
      url: [`${BASE}/`, `${BASE}/nosotros`, `${BASE}/noticias`, `${BASE}/contacto`],
      numberOfRuns: 3,
      settings: {
        chromeFlags: "--headless=new",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
    },
    assert: {
      // Se evalúa la mediana de las corridas de cada página.
      assertions: {
        "categories:performance": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
        "categories:accessibility": ["error", { minScore: 0.95, aggregationMethod: "median-run" }],
        "categories:best-practices": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
        "categories:seo": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
