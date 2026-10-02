import express from "express";
import { pinoHttp } from "pino-http";
import type { Logger } from "./lib/logger.js";
import type { BeaconReader } from "./beacons/store.js";
import { legacyBeaconsRouter } from "./routes/legacy-beacons.js";

export interface AppDeps {
  logger: Logger;
  beacons: { primary: BeaconReader; fallback: BeaconReader };
  // Comprueba la base de datos para /api/health. Lanza si no responde.
  pingDb: () => Promise<void>;
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    pinoHttp({ logger: deps.logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", async (_req, res) => {
    try {
      await deps.pingDb();
      res.json({ ok: true, db: "ok" });
    } catch {
      res.status(503).json({ ok: false, db: "sin conexión" });
    }
  });

  app.use(legacyBeaconsRouter({ ...deps.beacons, logger: deps.logger }));

  // Cualquier otra ruta: 404 sin pistas (la landing y el panel llegan en fases siguientes).
  app.use((_req, res) => {
    res.status(404).json({ error: "No encontrado" });
  });

  return app;
}
