import type { Db } from "../lib/prisma.js";
import type { BeaconInfo, BeaconRecord } from "./legacy-format.js";
import { readSnapshot, readSnapshotEntry } from "./snapshot.js";

// Lectura de las fichas para la app: una (GET /beacons/:major/:minor) o el catálogo
// completo que la app guarda para funcionar sin conexión. Es una interfaz para
// poder probar las rutas sin base de datos.
export interface BeaconReader {
  find(major: number, minor: number): Promise<BeaconInfo | null>;
  // Ordenado por major y minor.
  list(): Promise<BeaconRecord[]>;
}

export function prismaBeaconReader(db: Db): BeaconReader {
  return {
    find: (major, minor) =>
      db.beacon.findUnique({
        where: { major_minor: { major, minor } },
        select: { titulo: true, descripcion: true, ubicacion: true },
      }),
    list: () =>
      db.beacon.findMany({
        select: { major: true, minor: true, titulo: true, descripcion: true, ubicacion: true },
        orderBy: [{ major: "asc" }, { minor: "asc" }],
      }),
  };
}

export function snapshotBeaconReader(filePath: string): BeaconReader {
  return {
    find: (major, minor) => readSnapshotEntry(filePath, major, minor),
    list: async () =>
      (await readSnapshot(filePath)).sort((a, b) => a.major - b.major || a.minor - b.minor),
  };
}
