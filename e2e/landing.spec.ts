import { expect, test } from "@playwright/test";
import { ADMIN_PATH } from "./config.mjs";
import { recorrer, sinScrollHorizontal, sinViolaciones } from "./ayuda";

const PAGINAS = [
  { ruta: "/", nombre: "Inicio" },
  { ruta: "/nosotros", nombre: "Nosotros" },
  { ruta: "/noticias", nombre: "Noticias" },
  { ruta: "/contacto", nombre: "Contacto" },
];

test.describe("landing pública", () => {
  for (const { ruta, nombre } of PAGINAS) {
    test(`${nombre}: un solo h1, landmarks y axe en claro y oscuro`, async ({ page }) => {
      for (const esquema of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: esquema });
        await page.goto(ruta);
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.getByRole("main")).toBeVisible();
        await expect(page.getByRole("banner")).toBeVisible();
        await expect(page.getByRole("contentinfo")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", "es");
        await recorrer(page);
        await sinViolaciones(page, `${ruta} (${esquema})`);
      }
    });

    test(`${nombre}: sin scroll horizontal a 320 px y con el texto al 200 %`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(ruta);
      await sinScrollHorizontal(page);
      // Texto al 200 %: el control A+ llega al 150 %; aquí se fuerza el 200 % (WCAG 1.4.4).
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await page.setViewportSize({ width: 640, height: 720 });
      await sinScrollHorizontal(page);
    });
  }

  test("Nosotros muestra las tarjetas grandes del equipo en una sola fila", async ({ page }) => {
    await page.goto("/nosotros");
    const tarjetas = page.locator(".persona");
    await expect(tarjetas).toHaveCount(5);
    const ys = await tarjetas.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
    // En escritorio caben las cinco: la última se ve completa, sin desplazar.
    const ultima = (await tarjetas.nth(4).boundingBox())!;
    expect(ultima.x + ultima.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expect(page.getByRole("region", { name: /Integrantes del equipo/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "persona5@e2e.test" })).toBeVisible();

    // A 320 px la fila se desplaza de lado dentro de su región, sin scroll en la página.
    await page.setViewportSize({ width: 320, height: 720 });
    await sinScrollHorizontal(page);
    const region = page.getByRole("region", { name: /Integrantes del equipo/ });
    await expect(region).toHaveAttribute("tabindex", "0");
    await sinViolaciones(page, "/nosotros a 320 px");
  });

  test("en el inicio, el círculo de cada persona crece hasta ser una card al apuntar", async ({
    page,
  }) => {
    await page.goto("/");
    const primera = page.getByRole("button", { name: /^Ana Rojas/ });
    const ultima = page.getByRole("button", { name: /^Valentina Muñoz/ });
    // Cinco en una fila en pantalla ancha.
    const [y1, y5] = await Promise.all(
      [primera, ultima].map(async (b) => (await b.boundingBox())!.y),
    );
    expect(Math.abs(y1! - y5!)).toBeLessThan(2);

    await ultima.hover();
    await expect(ultima).toHaveAttribute("aria-expanded", "true");
    const card = page.locator(`[id="${await ultima.getAttribute("aria-controls")}"]`);
    await expect(card).toBeVisible();
    await expect(card.getByRole("link", { name: "persona5@e2e.test" })).toBeVisible();
    // La card nace sobre el círculo: empieza a la misma altura que la persona.
    const [cajaCard, cajaBoton] = [(await card.boundingBox())!, (await ultima.boundingBox())!];
    expect(Math.abs(cajaCard.y - cajaBoton.y)).toBeLessThan(4);
    await sinViolaciones(page, "/ con una card abierta");
    await page.keyboard.press("Escape");
    await expect(ultima).toHaveAttribute("aria-expanded", "false");

    // A 320 px, con el teclado, la card se corre para no salirse.
    await page.setViewportSize({ width: 320, height: 720 });
    await ultima.focus();
    await page.keyboard.press("Enter");
    await expect(card).toBeVisible();
    const caja = (await card.boundingBox())!;
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width).toBeLessThanOrEqual(320);
    await sinScrollHorizontal(page);
  });

  test("el enlace «Saltar al contenido» es lo primero y lleva al contenido", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const saltar = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(saltar).toBeFocused();
    await expect(saltar).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#contenido$/);
  });

  test("navegar mueve el foco al h1 de la página nueva", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Contacto" })
      .click();
    await expect(page.locator("h1")).toBeFocused();
    await expect(page).toHaveTitle(/^Contacto · /);
  });

  test("tema y tamaño de texto se recuerdan al recargar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: "Oscuro" }).check();
    await page.getByRole("button", { name: /^A\+/ }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("style", /font-size: 112.5%/);
  });

  test("el formulario de contacto valida, anuncia errores y envía", async ({ page }) => {
    await page.goto("/contacto");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.locator(".resumen-errores")).toBeFocused();
    await expect(page.getByLabel("Nombre")).toHaveAttribute("aria-invalid", "true");
    await page.getByLabel("Nombre").fill("Ana");
    await page.getByLabel("Correo electrónico").fill("ana@correo.cl");
    await page.getByLabel("Mensaje", { exact: true }).fill("Quiero conocer el proyecto SIGNAL.");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(
      page.getByText("Recibimos tu mensaje. Te responderemos a la brevedad."),
    ).toBeVisible();
  });
});

test.describe("el panel no existe para el público", () => {
  for (const ruta of ["/admin", "/login", "/panel", "/dashboard", `/${ADMIN_PATH.toUpperCase()}`]) {
    test(`${ruta} → 404 sin redirección`, async ({ request }) => {
      const res = await request.get(ruta, { maxRedirects: 0 });
      expect(res.status()).toBe(404);
      expect(await res.text()).not.toContain(ADMIN_PATH);
    });
  }

  test("HTML, robots.txt, sitemap.xml, manifest y service worker no mencionan el panel", async ({
    request,
  }) => {
    for (const ruta of [
      "/",
      "/robots.txt",
      "/sitemap.xml",
      "/manifest.webmanifest",
      "/sw.js",
      "/registerSW.js",
    ]) {
      const texto = await (await request.get(ruta)).text();
      expect(texto, ruta).not.toContain(ADMIN_PATH);
      expect(texto, ruta).not.toMatch(/\/api\/admin|admin\.html/);
    }
  });

  test("/api/admin sin sesión responde 401", async ({ request }) => {
    expect((await request.get("/api/admin/news")).status()).toBe(401);
  });

  test("la app Android sigue recibiendo GET /beacons/:major/:minor", async ({ request }) => {
    const res = await request.get("/beacons/999/999");
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: "No hay información para el beacon 999-999" });
  });
});
