// Levanta todo el entorno de desarrollo con un solo comando (npm run dev:all):
// la API, la landing y el panel, con la salida de cada uno marcada con su nombre.
// Ctrl+C cierra los tres. Si uno se cae, se cierran los demás para que no quede
// nada ocupando los puertos.

import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

const API = process.env.SIGNAL_API ?? "http://127.0.0.1:3000";
const WINDOWS = process.platform === "win32";

const PROCESOS = [
  { nombre: "api", script: "dev", color: 36 },
  { nombre: "web", script: "dev:web", color: 35 },
  { nombre: "panel", script: "dev:admin", color: 33 },
];

const ancho = Math.max(...PROCESOS.map((p) => p.nombre.length));
const etiqueta = ({ nombre, color }) => `\x1b[${color}m[${nombre.padEnd(ancho)}]\x1b[0m`;

const hijos = [];
let cerrando = false;

function lanzar(proceso) {
  const hijo = spawn("npm", ["run", proceso.script], {
    // En Windows npm es un .cmd y necesita la shell; en el resto, un grupo propio
    // para poder cerrar también los procesos que npm lance.
    shell: WINDOWS,
    detached: !WINDOWS,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  for (const salida of [hijo.stdout, hijo.stderr]) {
    createInterface({ input: salida }).on("line", (linea) => {
      console.log(`${etiqueta(proceso)} ${linea}`);
    });
  }
  hijo.on("exit", (codigo) => {
    if (cerrando) return;
    console.log(`${etiqueta(proceso)} terminó (código ${codigo ?? "?"}). Cerrando el resto...`);
    cerrarTodo(codigo || 1);
  });
  hijos.push(hijo);
}

// Cierra cada proceso con todos sus descendientes (npm → tsx/vite → node).
function matar(hijo) {
  if (hijo.exitCode !== null || !hijo.pid) return;
  if (WINDOWS) {
    spawnSync("taskkill", ["/pid", String(hijo.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-hijo.pid, "SIGTERM");
    } catch {
      // Ya había terminado.
    }
  }
}

function cerrarTodo(codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  hijos.forEach(matar);
  process.exit(codigo);
}

process.on("SIGINT", () => cerrarTodo(0));
process.on("SIGTERM", () => cerrarTodo(0));

async function apiLista() {
  for (let intento = 0; intento < 60 && !cerrando; intento++) {
    try {
      if ((await fetch(`${API}/api/health`)).ok) return true;
    } catch {
      // La API todavía está arrancando.
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// Primero la API; la landing y el panel después, para que el panel (que se abre
// solo en el navegador) no pida datos a una API que aún no responde.
const [api, ...frontends] = PROCESOS;
lanzar(api);
const lista = await apiLista();
if (!cerrando) {
  if (!lista) console.log(`${etiqueta(api)} no respondió en 60 s; arranco el resto igual.`);
  frontends.forEach(lanzar);
  // Las direcciones al final, para no buscarlas entre los logs.
  console.log(
    [
      "",
      "\x1b[32mTodo listo:\x1b[0m",
      `  Landing  http://localhost:5173`,
      `  Panel    http://localhost:5174/admin.html`,
      `  API      ${API.replace("127.0.0.1", "localhost")}`,
      "Ctrl+C para cerrar todo.",
      "",
    ].join("\n"),
  );
}
