import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "../lib/prisma.js";
import { beaconKey, type BeaconInfo, parseLegacyBeacons, toLegacyFile } from "./legacy-format.js";

// Copia local de los beacons en el formato de la app. Permite que
// GET /beacons/:major/:minor siga respondiendo si la base de datos no está disponible.

export async function writeBeaconSnapshot(db: Db, filePath: string): Promise<number> {
  const beacons = await db.beacon.findMany({
    select: { major: true, minor: true, titulo: true, descripcion: true, ubicacion: true },
  });
  await mkdir(path.dirname(filePath), { recursive: true });
  // Escritura atómica: si el proceso muere a mitad, el snapshot anterior queda intacto.
  const temporal = `${filePath}.tmp`;
  await writeFile(temporal, JSON.stringify(toLegacyFile(beacons), null, 2) + "\n", "utf-8");
  await rename(temporal, filePath);
  return beacons.length;
}

export async function readSnapshotEntry(
  filePath: string,
  major: number,
  minor: number,
): Promise<BeaconInfo | null> {
  const { beacons } = parseLegacyBeacons(JSON.parse(await readFile(filePath, "utf-8")));
  const clave = beaconKey(major, minor);
  return beacons.find((b) => beaconKey(b.major, b.minor) === clave) ?? null;
}
