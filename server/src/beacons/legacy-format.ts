import { z } from "zod";

// Formato histórico de beacons.json y de la respuesta que espera la app Android:
//   { "major-minor": { titulo, descripcion, ubicacion } }

export interface BeaconInfo {
  titulo: string;
  descripcion: string;
  ubicacion: string | null;
}

export interface BeaconRecord extends BeaconInfo {
  major: number;
  minor: number;
}

const UINT16_MAX = 65535;

// Acepta solo enteros en forma canónica ("1", "16", nunca "01" ni "1.0"), igual
// que el servidor anterior, que buscaba la clave literal "major-minor".
export function parseBeaconId(valor: string): number | null {
  if (!/^(0|[1-9]\d{0,4})$/.test(valor)) return null;
  const n = Number(valor);
  return n <= UINT16_MAX ? n : null;
}

export function beaconKey(major: number, minor: number): string {
  return `${major}-${minor}`;
}

// Cuerpo de GET /beacons/:major/:minor. Si no hay ubicación, la clave se omite,
// como ocurría con las fichas guardadas sin ese campo.
export function toLegacyBody(info: BeaconInfo) {
  return {
    titulo: info.titulo,
    descripcion: info.descripcion,
    ...(info.ubicacion !== null && { ubicacion: info.ubicacion }),
  };
}

const legacyEntrySchema = z.object({
  titulo: z.string().trim().min(1),
  descripcion: z.string().trim().min(1),
  ubicacion: z.string().nullish(),
});

const legacyFileSchema = z.record(z.string(), z.unknown());

export interface LegacyParseResult {
  beacons: BeaconRecord[];
  errores: string[];
}

// Interpreta un beacons.json. Las entradas inválidas no detienen la importación:
// se informan una por una para poder corregirlas.
export function parseLegacyBeacons(data: unknown): LegacyParseResult {
  const archivo = legacyFileSchema.safeParse(data);
  if (!archivo.success) {
    return { beacons: [], errores: ['El archivo no es un objeto { "major-minor": { ... } }.'] };
  }

  const beacons: BeaconRecord[] = [];
  const errores: string[] = [];
  for (const [clave, valor] of Object.entries(archivo.data)) {
    const [majorTxt = "", minorTxt = "", ...resto] = clave.split("-");
    const major = parseBeaconId(majorTxt);
    const minor = parseBeaconId(minorTxt);
    if (major === null || minor === null || resto.length > 0) {
      errores.push(
        `"${clave}": la clave debe tener la forma major-minor con números de 0 a 65535.`,
      );
      continue;
    }
    const entrada = legacyEntrySchema.safeParse(valor);
    if (!entrada.success) {
      errores.push(`"${clave}": faltan titulo o descripcion.`);
      continue;
    }
    const ubicacion = entrada.data.ubicacion?.trim();
    beacons.push({
      major,
      minor,
      titulo: entrada.data.titulo.trim(),
      descripcion: entrada.data.descripcion.trim(),
      ubicacion: ubicacion ? ubicacion : null,
    });
  }
  return { beacons, errores };
}

export function toLegacyFile(
  beacons: BeaconRecord[],
): Record<string, ReturnType<typeof toLegacyBody>> {
  const ordenados = [...beacons].sort((a, b) => a.major - b.major || a.minor - b.minor);
  return Object.fromEntries(ordenados.map((b) => [beaconKey(b.major, b.minor), toLegacyBody(b)]));
}
