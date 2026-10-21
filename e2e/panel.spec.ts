import { expect, test } from "@playwright/test";
import { PANEL } from "./config.mjs";
import { iniciarSesion, sinScrollHorizontal, sinViolaciones } from "./ayuda";

// El orden importa: el editor crea una nota que después publica la administradora.
test.describe.configure({ mode: "serial" });

const TITULO = "Nota de la prueba de punta a punta";

test("sin sesión, el panel muestra el login y explica los errores", async ({ page }) => {
  await page.goto(PANEL);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();
  await expect(page).toHaveTitle(/Panel SIGNAL/);
  const robots = (await page.request.get(PANEL)).headers()["x-robots-tag"];
  expect(robots).toBe("noindex, nofollow");
  await sinViolaciones(page, "login");

  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator(".resumen-errores")).toBeFocused();

  await page.getByLabel("Correo").fill("editor@e2e.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("no-es-la-clave-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos" }),
  ).toBeFocused();
});

test("el editor solo ve lo suyo y escribe una nota que envía a revisión", async ({ page }) => {
  await iniciarSesion(page, "editor");
  const menu = page.getByRole("navigation", { name: "Panel" }).getByRole("link");
  await expect(menu).toHaveText(["Resumen", "Secciones", "Noticias"]);
  await sinViolaciones(page, "resumen (editor)");

  // Por URL tampoco: la vista dice «sin acceso» (y la API respondería 403).
  await page.goto(`${PANEL}/beacons`);
  await expect(
    page.getByRole("heading", { level: 1, name: "No tienes acceso a esta sección" }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/beacons")).status()).toBe(403);

  await page.goto(`${PANEL}/noticias/nueva`);
  await page.getByLabel("Título", { exact: true }).fill(TITULO);
  await page.getByLabel("Bajada").fill("Escrita por el editor durante la prueba.");
  await page.getByLabel("Categoría").fill("Pruebas");
  const cuerpo = page.getByRole("textbox", { name: "Cuerpo de la nota" });
  await cuerpo.click();
  await page.keyboard.type("Primer párrafo de la nota.");
  // La barra del editor se recorre con flechas y anuncia el estado de cada botón.
  const barra = page.getByRole("toolbar", { name: /Formato/ });
  await expect(barra.getByRole("button", { name: "Negrita (Ctrl+B)" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await sinViolaciones(page, "editor de noticias");

  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/noticias\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await expect(page.getByText("Enviada a revisión")).toBeVisible();
  await expect(page.getByLabel("Título", { exact: true })).toBeDisabled();
});

test("la administradora publica la nota y aparece en el sitio", async ({ page }) => {
  await iniciarSesion(page, "admin");
  await page.getByRole("link", { name: TITULO }).click();
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Noticia publicada")).toBeVisible();
  const publicas = await (await page.request.get("/api/public/news")).json();
  expect(publicas.items.map((n: { title: string }) => n.title)).toContain(TITULO);
  await page.goto("/noticias");
  await expect(page.getByRole("link", { name: TITULO })).toBeVisible();
});

test("un beacon creado en el panel llega a la app Android", async ({ page }) => {
  await iniciarSesion(page, "admin");
  await page.goto(`${PANEL}/beacons`);
  await page.getByLabel("Major").fill("9");
  await page.getByLabel("Minor").fill("9");
  await page.getByLabel("Título", { exact: true }).fill("Punto de prueba");
  await page.getByLabel(/Descripción/).fill("Estás en el punto de prueba.");
  await page.getByRole("button", { name: "Registrar beacon" }).click();
  await expect(page.getByText("Beacon 9-9 guardado")).toBeVisible();
  const app = await page.request.get("/beacons/9/9");
  expect(await app.json()).toEqual({
    titulo: "Punto de prueba",
    descripcion: "Estás en el punto de prueba.",
  });

  // Borrar pide confirmación con un botón específico; el foco empieza en Cancelar.
  await page.getByRole("button", { name: "Borrar beacon 9-9" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await page.getByRole("alertdialog").getByRole("button", { name: "Borrar beacon 9-9" }).click();
  await expect(page.getByText("Beacon 9-9 borrado")).toBeVisible();
  expect((await page.request.get("/beacons/9/9")).status()).toBe(404);
});

test("todas las vistas del panel pasan axe en claro y oscuro", async ({ page }) => {
  await iniciarSesion(page, "admin");
  const vistas: [string, string][] = [
    ["", "Resumen"],
    ["/noticias", "Noticias"],
    ["/secciones", "Secciones"],
    ["/secciones/hero", "Portada"],
    ["/equipo", "Equipo y colaboradores"],
    ["/identidad", "Identidad visual"],
    ["/pie", "Pie de página"],
    ["/contacto", "Mensajes"],
    ["/perfil", "Mi perfil"],
    ["/beacons", "Beacons"],
    ["/usuarios", "Usuarios"],
    ["/bitacora", "Bitácora"],
  ];
  for (const esquema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: esquema });
    for (const [ruta, titulo] of vistas) {
      await page.goto(PANEL + ruta);
      await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
      await sinViolaciones(page, `${ruta || "/"} (${esquema})`);
    }
  }
});

test("en el teléfono el menú es un cajón operable con teclado y nada desborda", async ({
  page,
}) => {
  await iniciarSesion(page, "admin");
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(PANEL);
  const abrir = page.getByRole("button", { name: "Abrir menú" });
  await abrir.click();
  const cajon = page.locator("dialog.cajon");
  await expect(cajon).toHaveAttribute("open", "");
  await sinViolaciones(page, "cajón móvil");
  await page.keyboard.press("Escape");
  await expect(cajon).not.toHaveAttribute("open", "");

  await page.setViewportSize({ width: 320, height: 800 });
  for (const ruta of [
    "",
    "/noticias",
    "/noticias/nueva",
    "/secciones/hero",
    "/beacons",
    "/identidad",
    "/usuarios",
    "/bitacora",
    "/pie",
    "/perfil",
  ]) {
    await page.goto(PANEL + ruta);
    await expect(page.locator("h1")).toBeVisible();
    await sinScrollHorizontal(page);
  }
});
