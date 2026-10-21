import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { CUENTAS, PANEL } from "./config.mjs";

// axe-core con las reglas WCAG 2.1 A y AA. Falla con violaciones críticas o graves.
export async function sinViolaciones(page: Page, donde: string) {
  // Las vistas del panel entran con una transición de 300 ms.
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const graves = violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(graves, `Violaciones de accesibilidad en ${donde}`).toEqual([]);
}

export async function sinScrollHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra, "Ancho de más (scroll horizontal)").toBeLessThanOrEqual(0);
}

// La landing revela secciones al entrar en pantalla: se recorre para verlas todas.
export async function recorrer(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
  });
}

export async function iniciarSesion(page: Page, rol: keyof typeof CUENTAS) {
  await page.goto(`${PANEL}/login`);
  await page.getByLabel("Correo").fill(CUENTAS[rol].email);
  await page.getByLabel("Contraseña", { exact: true }).fill(CUENTAS[rol].clave);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Resumen" })).toBeVisible();
}
