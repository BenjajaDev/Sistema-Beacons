// Verificación de punta a punta del panel y la landing en Chrome real, con axe-core.
// Temporal: en la fase 7 pasa a Playwright en CI. Para ejecutarla a mano:
//   1. npm run build -w apps/web
//   2. cd server && npx tsx scripts/e2e-preparar.ts   (vacía y prepara la base signal_test)
//   3. Servidor de prueba en el puerto 3100 contra TEST_DATABASE_URL, con
//      ADMIN_PATH=panel-e2e-0123456789abcdefghij (por ejemplo, un server/.env.e2e)
//   4. node e2e/panel.mjs
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";

const require = createRequire(import.meta.url);
const BASE = "http://localhost:3100";
const P = `${BASE}/panel-e2e-0123456789abcdefghij`;
const AXE = require.resolve("axe-core/axe.min.js");
let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) fallos++;
};

const nav = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const page = await nav.newPage();
// La CSP del panel (correctamente) bloquea scripts inyectados: solo para inyectar axe.
await page.setBypassCSP(true);
await page.setViewport({ width: 1280, height: 900 });
page.on("pageerror", (e) => console.log("  ! error de JS en la página:", e.message));

const esperarH1 = (texto) =>
  page.waitForFunction(
    (t) => document.querySelector("h1")?.textContent.includes(t),
    { timeout: 15000 },
    texto,
  );
const esperarTexto = (texto) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 15000 }, texto);
const clicBoton = async (texto) => {
  const [b] = await page.$$(
    `xpath/.//button[normalize-space(.)="${texto}"] | .//a[normalize-space(.)="${texto}"]`,
  );
  if (!b) throw new Error(`No encontré el botón «${texto}»`);
  await b.click();
};
async function axe(nombre) {
  // Espera a que termine la transición de entrada de la vista (300 ms).
  await new Promise((r) => setTimeout(r, 450));
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: AXE });
  const v = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ["violations"] });
    return r.violations
      .filter((x) => ["critical", "serious"].includes(x.impact))
      .map((x) => `${x.id} (${x.nodes.length}): ${x.nodes[0].target}`);
  });
  ok(
    v.length === 0,
    `axe sin violaciones críticas/graves en ${nombre}${v.length ? " → " + v.join(" | ") : ""}`,
  );
}
async function login(email, clave) {
  await page.goto(P + "/login", { waitUntil: "networkidle0" });
  await page.type("#login-email", email);
  await page.type("#login-clave", clave);
  await clicBoton("Entrar");
  await esperarH1("Resumen");
}

console.log("1. Acceso");
await page.goto(P, { waitUntil: "networkidle0" });
await esperarH1("Iniciar sesión");
ok(page.url().endsWith("/login"), "sin sesión, el panel lleva al login");
await axe("login");
await clicBoton("Entrar");
ok(
  await page.evaluate(() => document.activeElement?.getAttribute("role") === "alert"),
  "enviar vacío enfoca el resumen de errores",
);
await page.type("#login-email", "editor@e2e.test");
await page.type("#login-clave", "incorrecta-1234");
await clicBoton("Entrar");
await esperarTexto("Correo o contraseña incorrectos");
ok(true, "contraseña incorrecta: mensaje claro");

console.log("2. Editor");
await login("editor@e2e.test", "Clave-E2E-Editor-2026");
const menuEditor = await page.$$eval("nav[aria-label=Panel] a", (as) =>
  as.map((a) => a.textContent.trim()),
);
ok(
  JSON.stringify(menuEditor) === JSON.stringify(["Resumen", "Noticias", "Secciones"]),
  `el menú del editor solo muestra lo permitido: ${menuEditor.join(", ")}`,
);
await axe("resumen (editor)");
await page.goto(P + "/beacons", { waitUntil: "networkidle0" });
await esperarH1("No tienes acceso");
ok(true, "el editor que entra a /beacons por URL ve «sin acceso»");

await page.goto(P + "/noticias/nueva", { waitUntil: "networkidle0" });
await esperarH1("Nueva noticia");
await page.type("#titulo", "Prueba de punta a punta");
await page.type("#bajada", "Una nota escrita por el editor en la prueba.");
await page.type("#categoria", "Pruebas");
await page.click(".editor__area");
await page.keyboard.type("Primer párrafo del cuerpo de la nota.");
await axe("editor de noticias");
await clicBoton("Guardar borrador");
await page.waitForFunction(() => /\/noticias\/[0-9a-f-]{36}$/.test(location.pathname), {
  timeout: 15000,
});
ok(true, "guardar una noticia nueva lleva a su URL (sin aviso falso de cambios sin guardar)");
await clicBoton("Enviar a revisión");
await esperarTexto("Enviada a revisión");
ok(
  await page.evaluate(() => document.body.innerText.includes("En revisión")),
  "la nota queda «En revisión»",
);
ok(
  await page.evaluate(() => !!document.querySelector("#titulo:disabled")),
  "en revisión, el editor ya no puede modificarla",
);
await clicBoton("Cerrar sesión");
await esperarH1("Iniciar sesión");

console.log("3. Administración");
await login("admin@e2e.test", "Clave-E2E-Admin-2026");
await esperarTexto("Prueba de punta a punta");
ok(true, "la nota aparece en «Noticias por revisar»");
await (await page.$("xpath/.//a[normalize-space(.)='Prueba de punta a punta']")).click();
await esperarH1("Editar noticia");
await clicBoton("Publicar");
await esperarTexto("Noticia publicada");
const publicas = await (await fetch(BASE + "/api/public/news")).json();
ok(
  publicas.items.some((n) => n.title === "Prueba de punta a punta"),
  "publicada por la admin, aparece en la API pública",
);

await page.goto(P + "/beacons", { waitUntil: "networkidle0" });
await esperarH1("Beacons");
await page.type("#beacon-major", "9");
await page.type("#beacon-minor", "9");
await page.type("#beacon-titulo", "Punto de prueba");
await page.type("#beacon-descripcion", "Estás en el punto de prueba.");
await clicBoton("Registrar beacon");
await esperarTexto("Beacon 9-9 guardado");
const app = await fetch(BASE + "/beacons/9/9");
ok(
  app.status === 200 && (await app.json()).titulo === "Punto de prueba",
  "la app Android recibe el beacon recién creado",
);
await axe("beacons");

for (const [ruta, titulo] of [
  ["/noticias", "Noticias"],
  ["/secciones", "Secciones"],
  ["/secciones/hero", "Portada"],
  ["/equipo", "Equipo y colaboradores"],
  ["/identidad", "Identidad visual"],
  ["/contacto", "Contacto"],
  ["/usuarios", "Usuarios"],
  ["/bitacora", "Bitácora"],
]) {
  await page.goto(P + ruta, { waitUntil: "networkidle0" });
  await esperarH1(titulo);
  await axe(ruta);
}

console.log("4. Móvil");
await page.setViewport({ width: 375, height: 800 });
await page.goto(P, { waitUntil: "networkidle0" });
await esperarH1("Resumen");
await page.click('button[aria-label="Abrir menú"]');
ok(
  await page.evaluate(() => document.querySelector("dialog.cajon")?.open),
  "en móvil, el menú se abre como cajón",
);
ok(
  await page.evaluate(() => document.activeElement?.closest("dialog.cajon") !== null),
  "el foco entra al cajón",
);
await axe("cajón móvil");
await page.keyboard.press("Escape");
ok(
  await page.evaluate(() => !document.querySelector("dialog.cajon")?.open),
  "Escape cierra el cajón",
);
for (const ruta of ["", "/noticias", "/beacons", "/identidad", "/usuarios"]) {
  await page.setViewport({ width: 320, height: 800 });
  await page.goto(P + ruta, { waitUntil: "networkidle0" });
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(
    sobra <= 0,
    `sin scroll horizontal a 320 px en ${ruta || "/"}${sobra > 0 ? ` (sobran ${sobra}px)` : ""}`,
  );
}

console.log("5. Tema oscuro");
await page.setViewport({ width: 1280, height: 900 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
for (const [ruta, titulo] of [
  ["", "Resumen"],
  ["/noticias", "Noticias"],
  ["/beacons", "Beacons"],
  ["/identidad", "Identidad visual"],
  ["/secciones/hero", "Portada"],
]) {
  await page.goto(P + ruta, { waitUntil: "networkidle0" });
  await esperarH1(titulo);
  await axe(`${ruta || "/"} en oscuro`);
}
for (const ruta of ["/", "/nosotros", "/noticias", "/contacto"]) {
  for (const esquema of ["light", "dark"]) {
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: esquema }]);
    await page.goto(BASE + ruta, { waitUntil: "networkidle0" });
    // La landing revela secciones al hacer scroll: se recorre para que axe vea todo.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await axe(`landing ${ruta} (${esquema === "dark" ? "oscuro" : "claro"})`);
  }
}

await nav.close();
console.log(
  fallos ? `\n${fallos} verificaciones fallaron.` : "\nTodas las verificaciones pasaron.",
);
process.exit(fallos ? 1 : 0);
