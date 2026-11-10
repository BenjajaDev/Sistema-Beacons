import { expect, test } from "@playwright/test";
import { ADMIN_PATH } from "./config.mjs";
import { recorrer, sinScrollHorizontal, sinTarjetasCortadas, sinViolaciones } from "./ayuda";

const PAGINAS = [
  { ruta: "/", nombre: "Inicio" },
  { ruta: "/nosotros", nombre: "Nosotros" },
  { ruta: "/noticias", nombre: "Noticias" },
  { ruta: "/recursos", nombre: "Recursos" },
  { ruta: "/galeria", nombre: "Galería" },
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
      // Texto al 200 % (WCAG 1.4.4), como lo haría el navegador: se fuerza en la raíz.
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await page.setViewportSize({ width: 640, height: 720 });
      await sinScrollHorizontal(page);
    });
  }

  test("Nosotros muestra al equipo completo en escritorio y un carrusel si no cabe", async ({
    page,
  }) => {
    await page.goto("/nosotros");
    const tarjetas = page.locator(".persona");
    await expect(tarjetas).toHaveCount(5);
    const enUnaFila = async () => {
      const ys = await tarjetas.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
    };

    // A 1280 px caben las 5 enteras: sin flechas, sin avance automático y sin
    // una región con scroll que enfocar.
    await enUnaFila();
    await sinTarjetasCortadas(page);
    await expect(page.locator(".carrusel__controles")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Integrantes del equipo" })).toHaveCount(0);
    await sinViolaciones(page, "/nosotros con el equipo completo");

    // Más angosto, tarjetas grandes (al menos 15rem) en un carrusel.
    await page.setViewportSize({ width: 700, height: 720 });
    const caja = (await tarjetas.first().boundingBox())!;
    expect(caja.width).toBeGreaterThanOrEqual(240);
    await enUnaFila();

    const carrusel = page.getByRole("region", { name: "Integrantes del equipo" });
    await expect(carrusel).toHaveAttribute("tabindex", "0");
    const anterior = page.getByRole("button", { name: "Ver integrantes anteriores" });
    const siguiente = page.getByRole("button", { name: "Ver más integrantes" });
    await expect(anterior).toHaveAttribute("aria-disabled", "true");
    await sinViolaciones(page, "/nosotros con el carrusel");

    // Avanza hasta el final sin dejar tarjetas cortadas en los bordes: la última
    // queda a la vista y «siguiente» se inactiva.
    await sinTarjetasCortadas(page);
    for (let i = 0; i < 5 && (await siguiente.getAttribute("aria-disabled")) !== "true"; i++) {
      await siguiente.click();
      await page.waitForTimeout(450);
      await sinTarjetasCortadas(page);
    }
    await expect(siguiente).toHaveAttribute("aria-disabled", "true");
    await expect(anterior).not.toHaveAttribute("aria-disabled");
    await expect(page.getByRole("link", { name: "persona5@e2e.test" })).toBeInViewport();

    // A 320 px el carrusel se recorre dentro de su región, sin scroll en la página.
    await page.setViewportSize({ width: 320, height: 720 });
    await sinScrollHorizontal(page);
    await sinTarjetasCortadas(page);
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
    const antes = (await primera.boundingBox())!;

    await ultima.hover();
    await expect(ultima).toHaveAttribute("aria-expanded", "true");
    const card = page.locator(`[id="${await ultima.getAttribute("aria-controls")}"]`);
    await expect(card).toBeVisible();
    await expect(card.getByRole("link", { name: "persona5@e2e.test" })).toBeVisible();
    // La card nace sobre el círculo: al terminar de crecer, su borde superior queda a
    // la altura de la persona. Se espera a que termine la animación de entrada.
    await expect
      .poll(async () => {
        const [cajaCard, cajaBoton] = [(await card.boundingBox())!, (await ultima.boundingBox())!];
        return Math.abs(cajaCard.y - cajaBoton.y);
      })
      .toBeLessThan(2);
    // Las demás personas se corren hacia afuera (aquí, a la izquierda) y se achican.
    await expect
      .poll(async () => {
        const despues = (await primera.boundingBox())!;
        return [despues.width / antes.width < 0.85, despues.x < antes.x];
      })
      .toEqual([true, true]);
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

  test("Zoom+ agranda la página sin scroll horizontal y se recuerda al recargar", async ({
    page,
  }) => {
    await page.goto("/");
    const zoom = page.getByRole("group", { name: "Zoom de la página" });
    await expect(zoom).toContainText("100 %");
    // 100 → 110 → 125 → 150 %.
    for (let i = 0; i < 3; i++) {
      await zoom.getByRole("button", { name: /^Zoom\+/ }).click();
    }
    await expect(zoom.getByRole("status")).toHaveText("Zoom al 150 %");
    await sinScrollHorizontal(page);
    await page.reload();
    // Con zoom, el encabezado pasa a «Menú», pero el zoom sigue a la vista para volver atrás.
    await expect(page.getByRole("button", { name: "Menú" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Zoom de la página" })).toContainText("150 %");
    await sinScrollHorizontal(page);
    await sinViolaciones(page, "/ con zoom al 150 %");
  });

  test("el inicio muestra «En cifras» y la línea de tiempo, con el estado dicho en palabras", async ({
    page,
  }) => {
    await page.goto("/");
    const cifras = page.getByRole("region", { name: "SIGNAL en cifras" });
    await expect(cifras.getByRole("listitem")).toHaveCount(3);
    await expect(cifras).toContainText("1.250+");
    const hitos = page.getByRole("region", { name: "Ruta del proyecto" });
    await expect(hitos.getByRole("listitem")).toHaveCount(3);
    for (const estado of ["Completado", "En curso", "Próximamente"]) {
      await expect(hitos.getByText(estado, { exact: false }).first()).toBeVisible();
    }
    // Un solo h1 en la página y las secciones nuevas usan h2.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(cifras.getByRole("heading", { level: 2 })).toHaveCount(1);
  });

  test("las secciones principales se pueden escuchar", async ({ page }) => {
    await page.goto("/");
    const escuchar = page.locator("#hero").getByRole("button", { name: "Escuchar esta sección" });
    // Solo si el navegador tiene voz (Web Speech API).
    if (await page.evaluate(() => "speechSynthesis" in window)) {
      await expect(escuchar).toBeVisible();
    }
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

  test("tema y zoom se recuerdan al recargar; el sitio no tiene A−/A+", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /^A\+/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Accesibilidad" }).click();
    await page.getByRole("radio", { name: "Oscuro" }).check();
    await page.getByRole("button", { name: /^Zoom\+/ }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("style", /--zoom-pagina: 1.1/);
  });

  test("alto contraste y fuente para dislexia: axe en todas las páginas, sin desborde y sin parpadeo", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Accesibilidad" }).click();
    await sinViolaciones(page, "/ con el panel de accesibilidad abierto");
    await page.getByRole("radio", { name: "Alto contraste" }).check();
    await page.getByRole("switch", { name: "Fuente para dislexia" }).check();
    await sinViolaciones(page, "/ con el panel abierto en alto contraste");

    const html = page.locator("html");
    for (const { ruta } of PAGINAS) {
      await page.goto(ruta);
      // theme-init.js aplica las preferencias antes del primer pintado.
      await expect(html).toHaveAttribute("data-contraste", "");
      await expect(html).toHaveAttribute("data-fuente", "dislexia");
      await recorrer(page);
      await sinViolaciones(page, `${ruta} en alto contraste`);
      await sinScrollHorizontal(page);
    }

    await page.setViewportSize({ width: 320, height: 800 });
    for (const { ruta } of PAGINAS) {
      await page.goto(ruta);
      await sinScrollHorizontal(page);
    }
    // En alto contraste con el panel abierto a 320 px tampoco se desborda.
    await page.getByRole("button", { name: "Accesibilidad" }).click();
    await sinScrollHorizontal(page);
    await sinViolaciones(page, "/ en alto contraste a 320 px con el panel abierto");
  });

  test("la guía de lectura sigue al puntero y no bloquea los clics", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Accesibilidad" }).click();
    await page.getByRole("switch", { name: "Guía de lectura" }).check();
    const guia = page.locator(".guia-lectura");
    await expect(guia).toBeAttached();
    await page.mouse.move(400, 500);
    await expect(guia).toHaveCSS("--guia-y", "500px");
    // Se puede seguir usando la página por debajo de la guía.
    await page.getByRole("switch", { name: "Guía de lectura" }).uncheck();
    await expect(guia).toHaveCount(0);
  });

  test("Contacto muestra el botón de WhatsApp y «Cómo llegar», sin mapa embebido", async ({
    page,
  }) => {
    await page.goto("/contacto");
    const whatsapp = page.getByRole("link", { name: /Escríbenos por WhatsApp/ });
    await expect(whatsapp).toHaveAttribute("href", "https://wa.me/56912345678");
    const caja = (await whatsapp.boundingBox())!;
    expect(caja.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("link", { name: /Cómo llegar a Av\. Libertador/ })).toHaveAttribute(
      "href",
      /google\.com\/maps\/search/,
    );
    await expect(page.locator("iframe")).toHaveCount(0);
    // El botón no es flotante: sigue su lugar en la página al desplazarse.
    await page.mouse.wheel(0, 600);
    expect(await whatsapp.evaluate((e) => getComputedStyle(e).position)).not.toBe("fixed");
    await sinViolaciones(page, "/contacto con WhatsApp y dirección");
  });

  test("Recursos lista, filtra y busca; el PDF y el DOI se abren en una pestaña nueva", async ({
    page,
  }) => {
    // El enlace del menú aparece porque hay recursos publicados.
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Recursos" }),
    ).toBeVisible();

    await page.goto("/recursos");
    await expect(page.locator("article.tarjeta-recurso")).toHaveCount(3);
    // Lo más reciente primero; lo que no trae fecha, al final.
    await expect(page.locator("article.tarjeta-recurso h2")).toHaveText([
      "Informe de impacto 2026",
      "Navegación interior con balizas BLE",
      "Guía de instalación de beacons",
    ]);
    const pdf = page.getByRole("link", { name: /Abrir PDF .*Informe de impacto 2026/ });
    await expect(pdf).toHaveAttribute("href", "/uploads/documentos/e2e.pdf");
    await expect(pdf).toHaveAttribute("target", "_blank");
    expect((await pdf.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("link", { name: /Ver por DOI: 10\.1234/ })).toHaveAttribute(
      "href",
      "https://doi.org/10.1234/signal.2026.01",
    );

    // Filtrar por tipo cambia la dirección y anuncia la cantidad.
    await page
      .getByRole("navigation", { name: "Tipos de recurso" })
      .getByRole("link", { name: "Guía y manual" })
      .click();
    await expect(page).toHaveURL(/\/recursos\?tipo=GUIDE/);
    await expect(page.locator("article.tarjeta-recurso")).toHaveCount(1);
    await expect(page.locator(".recursos__resultado")).toHaveText("1 recurso");

    // Buscar por texto.
    await page.goto("/recursos");
    await page.getByRole("searchbox").fill("balizas");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/q=balizas/);
    await expect(page.locator("article.tarjeta-recurso")).toHaveCount(1);
    await sinViolaciones(page, "/recursos con búsqueda");

    await page.getByRole("searchbox").fill("zzz");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByText("No encontramos recursos con ese filtro")).toBeVisible();
  });

  test("el boletín exige el consentimiento expreso y confirma la suscripción", async ({ page }) => {
    await page.goto("/");
    const seccion = page.locator("#boletin");
    await seccion.scrollIntoViewIfNeeded();
    const casilla = seccion.getByRole("checkbox");
    await expect(casilla).not.toBeChecked();
    expect((await casilla.boundingBox())!.height).toBeGreaterThanOrEqual(20);

    // Sin correo ni consentimiento no se envía y el foco va al primer error.
    await seccion.getByRole("button", { name: "Suscribirme" }).click();
    await expect(seccion.getByLabel("Correo electrónico")).toBeFocused();
    await expect(seccion.getByText("Escribe tu correo.")).toBeVisible();
    await expect(
      seccion.getByText("Marca la casilla para aceptar recibir el boletín."),
    ).toBeVisible();
    await sinViolaciones(page, "/ con el boletín y sus errores");

    await seccion.getByLabel("Correo electrónico").fill("lector@example.cl");
    await seccion.getByRole("button", { name: "Suscribirme" }).click();
    await expect(seccion.getByRole("checkbox")).toBeFocused();

    await casilla.check();
    await seccion.getByRole("button", { name: "Suscribirme" }).click();
    await expect(seccion.getByRole("status")).toContainText("Listo, quedaste suscrita o suscrito");
    await sinViolaciones(page, "/ con el boletín confirmado");
  });

  test("el formulario de contacto valida, anuncia errores y envía", async ({ page }) => {
    await page.goto("/contacto");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.locator(".resumen-errores")).toBeFocused();
    await expect(page.getByLabel("Nombre")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Motivo de la consulta")).toHaveAttribute("aria-invalid", "true");
    await page.getByLabel("Nombre").fill("Ana");
    await page.getByLabel("Motivo de la consulta").selectOption({ label: "Prensa" });
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
