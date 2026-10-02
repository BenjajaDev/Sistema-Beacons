// Levanta un PostgreSQL local para desarrollo sin Docker ni instalación global.
// Los datos quedan en server/.pgdata (ignorado por git). Se detiene con Ctrl+C.
//
//   npm run db:local
//
// Luego, en server/.env:
//   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/signal"

import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import path from "node:path";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 5433);
const DATA_DIR = path.resolve(import.meta.dirname, "..", ".pgdata");
const DATABASES = ["signal", "signal_test"];

// Si el puerto ya responde, lo más probable es que db:local ya esté corriendo.
const ocupado = await new Promise<boolean>((resolve) => {
  const socket = connect(PORT, "127.0.0.1")
    .once("connect", () => {
      socket.end();
      resolve(true);
    })
    .once("error", () => resolve(false));
});
if (ocupado) {
  console.log(`Ya hay un servidor escuchando en localhost:${PORT} (¿db:local ya está corriendo?).`);
  console.log("Si no es así, cambia el puerto con LOCAL_PG_PORT.");
  process.exit(0);
}

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
});

if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
  console.log("Inicializando el clúster en", DATA_DIR);
  await pg.initialise();
}

await pg.start();

for (const name of DATABASES) {
  try {
    await pg.createDatabase(name);
    console.log(`Base de datos "${name}" creada.`);
  } catch {
    // Ya existe.
  }
}

console.log(`PostgreSQL local escuchando en localhost:${PORT}`);
console.log(`DATABASE_URL="postgresql://postgres:postgres@localhost:${PORT}/signal"`);
console.log("Ctrl+C para detenerlo.");

async function detener() {
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", detener);
process.on("SIGTERM", detener);
// Mantiene vivo el proceso.
setInterval(() => {}, 1 << 30);
