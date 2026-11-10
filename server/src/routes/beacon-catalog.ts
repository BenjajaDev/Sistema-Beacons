import { createHash } from "node:crypto";
import { Router } from "express";
import type { BeaconRecord } from "../beacons/legacy-format.js";
import type { BeaconReader } from "../beacons/store.js";
import type { Logger } from "../lib/logger.js";

// GET /api/public/beacons: el catálogo completo de fichas, de solo lectura, para
// que la app Android lo guarde y oriente sin conexión. Es un agregado: el contrato
// GET /beacons/:major/:minor no cambia.
//
// `version` es un hash del contenido y va también como ETag: si la app manda
// If-None-Match con la que tiene, recibe un 304 vacío. Si la base no responde, el
// catálogo sale del snapshot local, igual que la ruta de una ficha.

export interface CatalogoBeacons {
  version: string;
  beacons: BeaconRecord[];
}

export function catalogoDe(beacons: BeaconRecord[]): CatalogoBeacons {
  const fichas = beacons.map(({ major, minor, titulo, descripcion, ubicacion }) => ({
    major,
    minor,
    titulo,
    descripcion,
    ubicacion,
  }));
  const version = createHash("sha256").update(JSON.stringify(fichas)).digest("hex").slice(0, 32);
  return { version, beacons: fichas };
}

export function beaconCatalogRouter(deps: {
  primary: BeaconReader;
  fallback: BeaconReader;
  logger: Logger;
}) {
  const router = Router();

  router.get("/api/public/beacons", async (_req, res) => {
    let beacons: BeaconRecord[];
    try {
      beacons = await deps.primary.list();
    } catch (err) {
      deps.logger.error({ err }, "Base de datos no disponible; el catálogo sale del snapshot");
      try {
        beacons = await deps.fallback.list();
      } catch (errSnapshot) {
        deps.logger.error({ err: errSnapshot }, "Tampoco se pudo leer el snapshot de beacons");
        res.status(503).json({
          error: "Servicio no disponible. Intenta de nuevo en unos minutos.",
          code: "UNAVAILABLE",
        });
        return;
      }
    }
    const catalogo = catalogoDe(beacons);
    // Siempre se revalida; Express responde 304 si el ETag coincide.
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("ETag", `"${catalogo.version}"`);
    res.json(catalogo);
  });

  return router;
}
