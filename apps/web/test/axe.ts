import axe from "axe-core";
import { expect } from "vitest";

// Ejecuta axe-core sobre un fragmento renderizado. El contraste de color no se
// puede calcular en jsdom (no hay CSS aplicado): lo cubren las pruebas en
// navegador real de la fase 7.
export async function expectNoAxeViolations(contenedor: Element) {
  const { violations } = await axe.run(contenedor, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  const resumen = violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
  expect(resumen).toEqual([]);
}
