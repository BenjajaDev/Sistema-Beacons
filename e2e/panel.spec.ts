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
  await expect(menu).toHaveText([
    "Resumen",
    "Secciones",
    "Noticias",
    "Recursos",
    "Galería",
    "Equipo y colaboradores",
    "Respaldos",
    "Identidad visual",
    "Pie de página",
    "Audiodescriptor",
    /^Mensajes/, // con el contador de no leídos, si hay mensajes
  ]);
  await sinViolaciones(page, "resumen (editor)");
  await page.getByRole("link", { name: "Equipo y colaboradores" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Equipo y colaboradores" }),
  ).toBeVisible();
  await expect(page.getByText("Ana Rojas").first()).toBeVisible();

  // Por URL tampoco: la vista dice «sin acceso» (y la API respondería 403).
  for (const ruta of ["/beacons", "/usuarios", "/bitacora"]) {
    await page.goto(`${PANEL}${ruta}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "No tienes acceso a esta sección" }),
    ).toBeVisible();
  }
  expect((await page.request.get("/api/admin/beacons")).status()).toBe(403);

  await page.goto(`${PANEL}/noticias/nueva`);
  await page.getByLabel("Título", { exact: true }).fill(TITULO);
  await page.getByLabel("Bajada").fill("Escrita por el editor durante la prueba.");
  await page.getByLabel("Categoría").selectOption({ label: "Eventos y talleres" });
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

test("comunicación solo ve los mensajes y el contacto, y edita las redes", async ({ page }) => {
  await iniciarSesion(page, "social");
  const menu = page.getByRole("navigation", { name: "Panel" }).getByRole("link");
  // «Mensajes» puede llevar el contador de no leídos (la landing envía uno antes).
  await expect(menu).toHaveText(["Resumen", /^Mensajes/, "Contacto y redes"]);
  await expect(page.getByRole("link", { name: "Nueva noticia" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Mensajes de contacto" })).toBeVisible();
  await sinViolaciones(page, "resumen (comunicación)");

  // El contenido del sitio no es suyo, ni por URL ni por la API.
  await page.goto(`${PANEL}/noticias`);
  await expect(
    page.getByRole("heading", { level: 1, name: "No tienes acceso a esta sección" }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/news")).status()).toBe(403);

  await page.goto(`${PANEL}/contacto`);
  await expect(page.getByRole("heading", { level: 1, name: "Mensajes" })).toBeVisible();
  await sinViolaciones(page, "mensajes (comunicación)");

  await page.goto(`${PANEL}/redes`);
  await expect(page.getByRole("heading", { level: 1, name: "Contacto y redes" })).toBeVisible();
  await sinViolaciones(page, "contacto y redes");
  await page.getByRole("textbox", { name: "Correo (opcional)" }).fill("comunicacion@signal.test");
  await page.getByRole("button", { name: "Guardar datos de contacto" }).click();
  await expect(page.getByText("Datos de contacto guardados.")).toBeVisible();
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

  // El filtro por categoría muestra la nota solo en su categoría.
  await page.getByRole("link", { name: "Eventos y talleres" }).click();
  await expect(page).toHaveURL(/categoria=Eventos/);
  await expect(page.getByRole("link", { name: TITULO })).toBeVisible();
  await sinViolaciones(page, "/noticias filtradas por categoría");
  await page.getByRole("link", { name: "Investigación" }).click();
  await expect(page.getByRole("link", { name: TITULO })).toHaveCount(0);
  await expect(page.getByText("Todavía no hay noticias en «Investigación»")).toBeVisible();

  // La nota lleva la firma y los enlaces para compartir (sin scripts de terceros).
  await page.goto("/noticias");
  await page.getByRole("link", { name: TITULO }).click();
  await expect(page.getByText(/Por /)).toBeVisible();
  const compartir = page.getByRole("complementary", { name: "Compartir esta noticia" });
  await expect(compartir.getByRole("link")).toHaveCount(3);
  await expect(compartir.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
    "href",
    /wa\.me\/\?text=.*noticias%2F/,
  );
  await sinViolaciones(page, "noticia con compartir");
});

test("la administradora edita las cifras y la línea de tiempo y se ven en el inicio", async ({
  page,
}) => {
  await iniciarSesion(page, "admin");

  await page.goto(`${PANEL}/secciones/cifras`);
  await expect(page.getByRole("heading", { level: 1, name: "En cifras" })).toBeVisible();
  const numero = page.getByLabel("Número").first();
  await numero.fill("77");
  // Una cifra nueva sin «Qué mide» no se guarda: el error queda junto al campo.
  await page.getByRole("button", { name: "Agregar cifra" }).click();
  await sinViolaciones(page, "editor de En cifras");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await page.getByLabel("Qué mide").last().fill("Personas capacitadas");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await page.getByRole("button", { name: "Publicar cambios" }).click();
  await expect(page.getByText("Sección publicada: ya se ve en el sitio.")).toBeVisible();

  await page.goto(`${PANEL}/secciones/objetivos`);
  await page.getByRole("radio", { name: "Voz", exact: true }).first().check();
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await page.getByRole("button", { name: "Publicar cambios" }).click();
  await expect(page.getByText("Sección publicada: ya se ve en el sitio.")).toBeVisible();

  await page.goto(`${PANEL}/secciones/hitos`);
  await expect(page.getByRole("heading", { level: 1, name: "Línea de tiempo" })).toBeVisible();
  await page.getByRole("radio", { name: "En curso", exact: true }).first().check();
  await sinViolaciones(page, "editor de la línea de tiempo");

  await page.goto("/");
  await expect(page.getByRole("region", { name: "SIGNAL en cifras" })).toContainText("77");
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

test("agregar una persona con foto encuadrada no cierra el formulario", async ({ page }) => {
  // Regresión: al pulsar «Usar este encuadre», el cierre del diálogo de encuadre
  // cerraba también el de «Agregar persona» y no se podía guardar.
  await iniciarSesion(page, "admin");
  await page.goto(`${PANEL}/equipo`);
  await page.getByRole("button", { name: "Agregar persona" }).first().click();
  const formulario = page.getByRole("dialog", { name: "Agregar persona" });
  await formulario.getByLabel("Nombre").fill("Ana Prueba");
  await formulario.getByLabel("Cargo o rol").fill("Coordinación");
  // Imagen apaisada (346 × 223): el marco de las fotos es cuadrado y se ofrece encuadrarla.
  await formulario.locator("input[type=file]").setInputFiles("apps/web/scripts/isotipo.png");
  const encuadre = page.getByRole("dialog", { name: "Encuadrar la imagen" });
  await expect(encuadre).toBeVisible();
  await encuadre.getByRole("button", { name: "Usar este encuadre" }).click();
  await expect(encuadre).toBeHidden();

  await expect(formulario).toBeVisible();
  await formulario.getByLabel("Texto alternativo").fill("Ana sonriendo frente a un pizarrón");
  await formulario.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Persona agregada.")).toBeVisible();
  await expect(page.getByText("Ana Prueba", { exact: true }).first()).toBeVisible();
});

test("el editor agrega un respaldo y aparece en el pie, aparte de los colaboradores", async ({
  page,
}) => {
  await iniciarSesion(page, "editor");
  await page.getByRole("link", { name: "Respaldos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Respaldos" })).toBeVisible();
  await page.getByRole("button", { name: "Agregar respaldo" }).first().click();
  const dialogo = page.getByRole("dialog");
  // El tipo de respaldo es obligatorio y su error queda junto al campo.
  await dialogo.getByLabel("Nombre de la institución").fill("Conocimientos 2030");
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  await expect(dialogo.getByText(/Escribe el tipo de respaldo/)).toBeVisible();
  await dialogo.getByLabel("Tipo de respaldo").fill("Financia");
  await dialogo
    .getByLabel(/Mención/)
    .fill("Proyecto financiado por el programa Conocimientos 2030.");
  await dialogo.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Respaldo agregado.")).toBeVisible();

  for (const ruta of ["/", "/contacto"]) {
    await page.goto(ruta);
    const pie = page.getByRole("contentinfo");
    await expect(pie.getByRole("heading", { name: "Con el respaldo de" })).toBeVisible();
    await expect(pie.getByText("Conocimientos 2030", { exact: true })).toBeVisible();
    await expect(pie.getByText("Financia", { exact: true })).toBeVisible();
  }
  await sinViolaciones(page, "pie con respaldos");
  expect((await (await page.request.get("/api/public/collaborators")).json()).items).toEqual([]);
});

test("Nosotros agrupa al comité consultivo y a las organizaciones por tipo", async ({ page }) => {
  await iniciarSesion(page, "admin");
  await page.goto(`${PANEL}/equipo`);

  await page.getByRole("button", { name: "Agregar persona" }).first().click();
  const persona = page.getByRole("dialog", { name: "Agregar persona" });
  await persona.getByLabel("Nombre").fill("Marcos Asesor");
  await persona.getByLabel("Cargo o rol").fill("Asesoría metodológica");
  await persona.getByLabel("Grupo").selectOption({ label: "Comité consultivo" });
  await persona.getByLabel("Institución").fill("Universidad de Chile");
  await sinViolaciones(page, "formulario de persona con grupo");
  await persona.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Persona agregada.")).toBeVisible();

  await page.getByRole("button", { name: "Agregar colaborador" }).first().click();
  const colaborador = page.getByRole("dialog", { name: "Agregar colaborador" });
  await colaborador.getByLabel("Nombre").fill("Universidad Norte");
  await colaborador.getByLabel("Tipo de organización").selectOption({
    label: "Instituciones académicas",
  });
  await colaborador.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Colaborador agregado.")).toBeVisible();
  await page.getByRole("button", { name: "Agregar colaborador" }).first().click();
  await page
    .getByRole("dialog", { name: "Agregar colaborador" })
    .getByLabel("Nombre")
    .fill("Taller Sur");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Colaborador agregado.")).toBeVisible();

  await page.goto("/nosotros");
  const grupos = page.locator(".grupo-equipo__titulo");
  await expect(grupos).toHaveText([
    "Equipo",
    "Comité consultivo",
    "Instituciones académicas",
    "Otras organizaciones",
  ]);
  const comite = page.locator(".grupo-equipo", { hasText: "Comité consultivo" });
  await expect(comite.getByRole("heading", { level: 4, name: "Marcos Asesor" })).toBeVisible();
  await expect(comite.getByText("Universidad de Chile")).toBeVisible();
  await sinViolaciones(page, "/nosotros con grupos");
  // En el inicio solo aparece el equipo, no el comité.
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Marcos Asesor/ })).toHaveCount(0);
});

test("el editor sube un PDF, agrega un recurso y se ve en la página pública", async ({ page }) => {
  await iniciarSesion(page, "editor");
  await page.getByRole("link", { name: "Recursos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Recursos" })).toBeVisible();
  await page.getByRole("button", { name: "Agregar recurso" }).first().click();
  const formulario = page.getByRole("dialog", { name: "Agregar recurso" });

  // Sin archivo, DOI ni enlace no se guarda, y el error queda junto al archivo.
  await formulario.getByLabel("Título").fill("Guía de uso con lector de pantalla");
  await formulario.getByRole("button", { name: "Guardar" }).click();
  await expect(formulario.getByRole("alert").filter({ hasText: /Sube un PDF/ })).toBeVisible();

  // Un archivo que no es PDF se rechaza aunque se llame .pdf.
  await formulario.locator("input[type=file]").setInputFiles({
    name: "falso.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("esto no es un pdf"),
  });
  await expect(page.getByText(/Solo se aceptan archivos PDF/).first()).toBeVisible();

  await formulario.locator("input[type=file]").setInputFiles({
    name: "guia.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% prueba\n%%EOF\n"),
  });
  await expect(formulario.getByText("guia.pdf")).toBeVisible();
  await formulario.getByLabel("Tipo").selectOption({ label: "Guía y manual" });
  await formulario.getByLabel("Fecha de publicación").fill("2026-09-10");
  await sinViolaciones(page, "formulario de recurso");
  await formulario.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Recurso agregado.")).toBeVisible();

  await page.goto("/recursos");
  const tarjeta = page.locator("article.tarjeta-recurso", {
    hasText: "Guía de uso con lector de pantalla",
  });
  await expect(tarjeta.getByRole("link", { name: /Abrir PDF/ })).toHaveAttribute(
    "href",
    /\/uploads\/documentos\/.+\.pdf$/,
  );
  await sinViolaciones(page, "/recursos con el PDF subido");
});

test("el editor agrega una foto con su descripción y aparece en la galería pública", async ({
  page,
}) => {
  await iniciarSesion(page, "editor");
  await page.getByRole("link", { name: "Galería" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Galería" })).toBeVisible();
  await page.getByRole("button", { name: "Agregar foto" }).first().click();
  const formulario = page.getByRole("dialog", { name: "Agregar foto" });
  await formulario.getByLabel("Pie de foto").fill("Prueba del recorrido en la biblioteca");
  await formulario.getByLabel("Crédito").fill("Foto: Equipo SIGNAL");
  await formulario.locator("input[type=file]").setInputFiles("apps/web/scripts/isotipo.png");
  // Sin texto alternativo no se guarda.
  await formulario.getByRole("button", { name: "Guardar" }).click();
  await expect(formulario.getByText(/Describe la (foto|imagen)/).first()).toBeVisible();
  await formulario
    .getByLabel("Texto alternativo")
    .fill("Una persona con bastón sigue las indicaciones de voz del teléfono");
  await sinViolaciones(page, "formulario de foto");
  await formulario.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Foto agregada.")).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Galería" }),
  ).toBeVisible();
  await page.goto("/galeria");
  await expect(
    page.getByRole("img", {
      name: "Una persona con bastón sigue las indicaciones de voz del teléfono",
    }),
  ).toBeVisible();
  await expect(page.getByText("Foto: Equipo SIGNAL")).toBeVisible();
  await sinViolaciones(page, "/galeria con una foto");
});

test("un mensaje se responde por Gmail, Outlook, la app de correo o copiando la dirección", async ({
  page,
}) => {
  const envio = await page.request.post("/api/public/contact", {
    data: {
      nombre: "Persona de la prueba",
      correo: "persona.prueba@e2e.test",
      asunto: "Consulta",
      mensaje: "Quiero saber más sobre SIGNAL.",
    },
  });
  expect(envio.status()).toBe(201);
  await iniciarSesion(page, "admin");
  await page.goto(`${PANEL}/contacto`);
  const responder = page.getByRole("button", { name: "Responder a Persona de la prueba" }).first();
  await responder.click();
  await expect(responder).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: /^En Gmail/ }).first()).toHaveAttribute(
    "href",
    /mail\.google\.com.*to=persona\.prueba%40e2e\.test&su=Re%3A%20Consulta/,
  );
  for (const esquema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: esquema });
    await sinViolaciones(page, `responder un mensaje (${esquema})`);
  }
  await page.keyboard.press("Escape");
  await expect(responder).toHaveAttribute("aria-expanded", "false");
});

test("todas las vistas del panel pasan axe en claro y oscuro", async ({ page }) => {
  // 10 vistas × 2 temas, con un análisis de axe en cada una.
  test.setTimeout(180_000);
  await iniciarSesion(page, "admin");
  const vistas: [string, string][] = [
    ["", "Resumen"],
    ["/noticias", "Noticias"],
    ["/recursos", "Recursos"],
    ["/galeria", "Galería"],
    ["/secciones", "Secciones"],
    ["/secciones/hero", "Portada"],
    ["/secciones/cifras", "En cifras"],
    ["/secciones/hitos", "Línea de tiempo"],
    ["/equipo", "Equipo y colaboradores"],
    ["/respaldos", "Respaldos"],
    ["/identidad", "Identidad visual"],
    ["/pie", "Pie de página"],
    ["/audiodescriptor", "Audiodescriptor"],
    ["/contacto", "Mensajes"],
    ["/redes", "Contacto y redes"],
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
