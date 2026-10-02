import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { Prisma } from "../generated/prisma/client.js";
import type { Db } from "../lib/prisma.js";

// Respaldo local completo de la base de datos en un JSON comprimido.
// Incluye los hashes de contraseña: la carpeta de respaldos es sensible y no se versiona.

const PREFIJO = "signal-backup-";
const EXTENSION = ".json.gz";
export const BACKUP_FORMAT_VERSION = 1;

// Orden de inserción que respeta las claves foráneas. El borrado va al revés.
const TABLAS = [
  "user",
  "media",
  "siteSettings",
  "section",
  "news",
  "teamMember",
  "collaborator",
  "beacon",
  "auditLog",
  "contactMessage",
] as const;

type Tabla = (typeof TABLAS)[number];
type Filas = Record<string, unknown>[];

export interface BackupFile {
  version: number;
  createdAt: string;
  data: Record<Tabla, Filas>;
}

// Campos Json opcionales: un null del respaldo debe volver como NULL de SQL.
const JSON_NULLABLES: Partial<Record<Tabla, string[]>> = {
  section: ["draftContent"],
  auditLog: ["meta"],
};

// Acceso genérico a un delegado de Prisma por nombre de modelo.
interface Delegado {
  findMany(): Promise<Filas>;
  createMany(args: { data: Filas }): Promise<{ count: number }>;
  deleteMany(): Promise<{ count: number }>;
}
function delegado(db: Db | Prisma.TransactionClient, tabla: Tabla): Delegado {
  return (db as unknown as Record<Tabla, Delegado>)[tabla];
}

export async function exportDatabase(db: Db): Promise<BackupFile> {
  const data = {} as Record<Tabla, Filas>;
  for (const tabla of TABLAS) data[tabla] = await delegado(db, tabla).findMany();
  return { version: BACKUP_FORMAT_VERSION, createdAt: new Date().toISOString(), data };
}

export async function createBackup(db: Db, dir: string, keep: number): Promise<string> {
  const respaldo = await exportDatabase(db);
  await mkdir(dir, { recursive: true });
  const sello = respaldo.createdAt.replaceAll(":", "-").replace(/\.\d+Z$/, "Z");
  const archivo = path.join(dir, `${PREFIJO}${sello}${EXTENSION}`);
  await writeFile(archivo, gzipSync(JSON.stringify(respaldo)));
  await rotateBackups(dir, keep);
  return archivo;
}

export async function listBackups(dir: string): Promise<string[]> {
  try {
    const archivos = await readdir(dir);
    // El sello ISO ordena cronológicamente como texto.
    return archivos.filter((f) => f.startsWith(PREFIJO) && f.endsWith(EXTENSION)).sort();
  } catch {
    return [];
  }
}

async function rotateBackups(dir: string, keep: number) {
  const archivos = await listBackups(dir);
  const sobran = archivos.slice(0, Math.max(0, archivos.length - keep));
  await Promise.all(sobran.map((f) => rm(path.join(dir, f))));
}

export async function readBackup(archivo: string): Promise<BackupFile> {
  const respaldo = JSON.parse(gunzipSync(await readFile(archivo)).toString("utf-8")) as BackupFile;
  if (respaldo.version !== BACKUP_FORMAT_VERSION || !respaldo.data) {
    throw new Error(`Formato de respaldo no reconocido (versión ${String(respaldo.version)}).`);
  }
  return respaldo;
}

// Reemplaza TODO el contenido de la base por el del respaldo, en una transacción:
// si algo falla, la base queda como estaba.
export async function restoreDatabase(
  db: Db,
  respaldo: BackupFile,
): Promise<Record<Tabla, number>> {
  const conteo = {} as Record<Tabla, number>;
  await db.$transaction(
    async (tx) => {
      for (const tabla of [...TABLAS].reverse()) await delegado(tx, tabla).deleteMany();
      for (const tabla of TABLAS) {
        const filas = (respaldo.data[tabla] ?? []).map((fila) => {
          const copia = { ...fila };
          for (const campo of JSON_NULLABLES[tabla] ?? []) {
            if (copia[campo] === null) copia[campo] = Prisma.DbNull;
          }
          return copia;
        });
        conteo[tabla] = filas.length
          ? (await delegado(tx, tabla).createMany({ data: filas })).count
          : 0;
      }
    },
    { timeout: 120_000 },
  );
  return conteo;
}
