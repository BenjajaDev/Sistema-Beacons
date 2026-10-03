import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { BASE } from "./config.mjs";

// Lighthouse 12+ ya no tiene categoría PWA: la instalabilidad se verifica con la
// misma comprobación que usa Chrome (Page.getInstallabilityErrors).

test("la landing es instalable como PWA", async () => {
  // Perfil persistente: en incógnito (el contexto normal de Playwright) Chrome no
  // permite instalar aplicaciones y lo informa como error de instalabilidad.
  const perfil = mkdtempSync(path.join(tmpdir(), "signal-pwa-"));
  const context = await chromium.launchPersistentContext(perfil, {
    channel: process.env.PW_CANAL || undefined,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(BASE + "/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);

  const manifiesto = await (await page.request.get(BASE + "/manifest.webmanifest")).json();
  expect(manifiesto).toMatchObject({ lang: "es", display: "standalone", start_url: "/" });
  expect(manifiesto.icons.map((i: { purpose: string }) => i.purpose)).toContain("maskable");
  await context.close();
  rmSync(perfil, { recursive: true, force: true });
});

test("el service worker solo precarga y atiende la landing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cacheado = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const nombre of await caches.keys()) {
      for (const r of await (await caches.open(nombre)).keys()) urls.push(new URL(r.url).pathname);
    }
    return urls;
  });
  expect(cacheado).toContain("/offline.html");
  expect(cacheado.some((u) => /admin|panel/i.test(u))).toBe(false);
});

test("sin conexión, las páginas visitadas cargan y las demás muestran la página offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.goto("/nosotros");
  await expect(page.locator("h1")).toBeVisible();

  await context.setOffline(true);
  await page.goto("/nosotros");
  await expect(page.locator("h1")).toHaveText("Quiénes somos");
  await page.goto("/contacto");
  await expect(page.locator("h1")).toHaveText("Estás sin conexión");
  await context.setOffline(false);
});
