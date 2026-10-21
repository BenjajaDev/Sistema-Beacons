import type { Db } from "../lib/prisma.js";
import type { BeaconInfo } from "./legacy-format.js";
import { readSnapshotEntry } from "./snapshot.js";

// Lectura de una ficha para la app. Es una interfaz para poder probar la ruta
// sin base de datos.
export interface BeaconReader {
  find(major: number, minor: number): Promise<BeaconInfo | null>;
}

export function prismaBeaconReader(db: Db): BeaconReader {
  return {
    find: (major, minor) =>
      db.beacon.findUnique({
        where: { major_minor: { major, minor } },
        select: { titulo: true, descripcion: true, ubicacion: true },
      }),
  };
}

export function snapshotBeaconReader(filePath: string): BeaconReader {
  return { find: (major, minor) => readSnapshotEntry(filePath, major, minor) };
}
