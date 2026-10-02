import { pino, type Logger } from "pino";
import { createApp } from "../../src/app.js";
import type { BeaconReader } from "../../src/beacons/store.js";
import type { Db } from "../../src/lib/prisma.js";
import { testEnv } from "./env.js";

const sinBeacons: BeaconReader = { find: async () => null };

// Sin `db`, cualquier acceso a la base falla: sirve para probar lo que no debería tocarla.
const dbAusente = new Proxy({} as Db, {
  get: () => {
    throw new Error("Este test no debería acceder a la base de datos.");
  },
});

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
    beacons: opts.beacons ?? { primary: sinBeacons, fallback: sinBeacons },
    pingDb: async () => {},
  });
}
