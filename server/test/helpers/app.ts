import { pino, type Logger } from "pino";
import { createApp } from "../../src/app.js";
import { prismaBeaconReader, type BeaconReader } from "../../src/beacons/store.js";
import type { Db } from "../../src/lib/prisma.js";
import { testEnv } from "./env.js";

const sinBeacons: BeaconReader = { find: async () => null };

// Sin `db`, cualquier consulta falla: sirve para probar lo que no debería tocar la base.
// Leer propiedades (db.teamMember) está permitido; lo que falla es llamar a un método.
function sinBase(): Db {
  const handler: ProxyHandler<() => void> = {
    get: (_t, prop) => (prop === "then" ? undefined : new Proxy(() => {}, handler)),
    apply: () => {
      throw new Error("Este test no debería acceder a la base de datos.");
    },
  };
  return new Proxy(() => {}, handler) as unknown as Db;
}
const dbAusente = sinBase();

export function buildTestApp(
  opts: {
    db?: Db;
    env?: Record<string, string>;
    logger?: Logger;
    beacons?: { primary: BeaconReader; fallback: BeaconReader };
  } = {},
) {
  return createApp({
    env: testEnv(opts.env),
    db: opts.db ?? dbAusente,
    logger: opts.logger ?? pino({ level: "silent" }),
    // Con base de datos, la ruta de la app lee la base real, como en producción.
    beacons:
      opts.beacons ??
      (opts.db
        ? { primary: prismaBeaconReader(opts.db), fallback: sinBeacons }
        : { primary: sinBeacons, fallback: sinBeacons }),
    pingDb: async () => {},
  });
}
