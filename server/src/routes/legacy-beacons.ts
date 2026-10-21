import { Router } from "express";
import type { Logger } from "../lib/logger.js";
import {
  beaconKey,
  parseBeaconId,
  toLegacyBody,
  type BeaconInfo,
} from "../beacons/legacy-format.js";
import type { BeaconReader } from "../beacons/store.js";

// GET /beacons/:major/:minor: contrato con la app Android. NO cambiar la ruta,
// los nombres de los campos ni el cuerpo del 404 sin actualizar la app.
//
// Si la base de datos falla, responde desde el snapshot local para que la
// orientación de las personas usuarias no se interrumpa.
export function legacyBeaconsRouter(deps: {
  primary: BeaconReader;
  fallback: BeaconReader;
  logger: Logger;
}) {
  const router = Router();

  router.get("/beacons/:major/:minor", async (req, res) => {
    const { major: majorTxt, minor: minorTxt } = req.params;
    const clave = `${majorTxt}-${minorTxt}`;
    const major = parseBeaconId(majorTxt);
    const minor = parseBeaconId(minorTxt);

    let info: BeaconInfo | null = null;
    if (major !== null && minor !== null) {
      try {
        info = await deps.primary.find(major, minor);
      } catch (err) {
        deps.logger.error(
          { err, beacon: clave },
          "Base de datos no disponible; se usa el snapshot",
        );
        try {
          info = await deps.fallback.find(major, minor);
        } catch (errSnapshot) {
          deps.logger.error({ err: errSnapshot }, "Tampoco se pudo leer el snapshot de beacons");
          res
            .status(503)
            .json({ error: "Servicio no disponible. Intenta de nuevo en unos minutos." });
          return;
        }
      }
    }

    if (!info) {
      deps.logger.info({ beacon: clave }, "Beacon no encontrado");
      res.status(404).json({ error: `No hay información para el beacon ${clave}` });
      return;
    }

    deps.logger.info({ beacon: beaconKey(major!, minor!) }, "Ficha de beacon servida");
    res.json(toLegacyBody(info));
  });

  return router;
}
