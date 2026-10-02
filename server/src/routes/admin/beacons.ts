import { z } from "zod";
import { beaconKey } from "../../beacons/legacy-format.js";
import { Prisma } from "../../generated/prisma/client.js";
import { ApiError, notFound, parseOrThrow } from "../../http/errors.js";
import type { AdminDeps } from "./deps.js";
import { changedFields, idParam, textoOpcional } from "./helpers.js";
import { ADMIN_ONLY, type AdminRoute } from "./registry.js";

// CMS de beacons (antes en cms/, sin autenticación). Solo administración.
// Lo que se guarda aquí es lo que la app Android lee y anuncia por voz.

const idBeacon = (campo: string) =>
  z.coerce
    .number(`Escribe el ${campo}.`)
    .int(`El ${campo} debe ser un número entero.`)
    .min(0, `El ${campo} va de 0 a 65535.`)
    .max(65535, `El ${campo} va de 0 a 65535.`);

const beaconSchema = z.object({
  major: idBeacon("major"),
  minor: idBeacon("minor"),
  titulo: z.string("Escribe un título.").trim().min(1, "Escribe un título.").max(120),
  // Es el texto que la app lee en voz alta: ver docs/estrategia-audiodescripcion.md.
  descripcion: z
    .string("Escribe la descripción que se leerá en voz alta.")
    .trim()
    .min(1, "Escribe la descripción que se leerá en voz alta.")
    .max(1000),
  ubicacion: textoOpcional(120),
});

// Una ficha está completa si tiene los tres campos que muestra la app.
export function isComplete(b: { titulo: string; descripcion: string; ubicacion: string | null }) {
  return Boolean(b.titulo.trim() && b.descripcion.trim() && b.ubicacion?.trim());
}

function duplicado(major: number, minor: number) {
  return new ApiError(409, "VALIDATION", "Revisa los campos marcados.", {
    campos: {
      minor: `Ya existe un beacon ${beaconKey(major, minor)}. Usa otro major/minor o edita ese.`,
    },
  });
}

export function beaconRoutes({ db, audit, onBeaconsChanged }: AdminDeps): AdminRoute[] {
  async function guardar<T>(major: number, minor: number, operacion: () => Promise<T>) {
    try {
      return await operacion();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw duplicado(major, minor);
      }
      throw err;
    }
  }

  return [
    {
      roles: ADMIN_ONLY,
      method: "get",
      path: "/beacons",
      handler: async (_req, res) => {
        const filas = await db.beacon.findMany({
          orderBy: [{ major: "asc" }, { minor: "asc" }],
          include: { updatedBy: { select: { name: true } } },
        });
        const items = filas.map((b) => ({
          ...b,
          clave: beaconKey(b.major, b.minor),
          completo: isComplete(b),
        }));
        const completos = items.filter((b) => b.completo).length;
        res.json({
          items,
          resumen: { total: items.length, completos, incompletos: items.length - completos },
        });
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "post",
      path: "/beacons",
      handler: async (req, res) => {
        const d = parseOrThrow(beaconSchema, req.body);
        const beacon = await guardar(d.major, d.minor, () =>
          db.beacon.create({ data: { ...d, updatedById: req.user!.id } }),
        );
        await onBeaconsChanged();
        await audit(req, {
          action: "BEACON_CREATE",
          entity: "Beacon",
          entityId: beacon.id,
          meta: { clave: beaconKey(d.major, d.minor) },
        });
        res.status(201).json({
          beacon: {
            ...beacon,
            clave: beaconKey(beacon.major, beacon.minor),
            completo: isComplete(beacon),
          },
        });
      },
    },
    {
      // Editar puede cambiar major/minor: es una sola actualización, así que la
      // ficha nunca queda duplicada ni se pierde a mitad de camino.
      roles: ADMIN_ONLY,
      method: "put",
      path: "/beacons/:id",
      handler: async (req, res) => {
        const id = idParam(req, "El beacon");
        const antes = await db.beacon.findUnique({ where: { id } });
        if (!antes) throw notFound("El beacon");
        const d = parseOrThrow(beaconSchema, req.body);
        const beacon = await guardar(d.major, d.minor, () =>
          db.beacon.update({ where: { id }, data: { ...d, updatedById: req.user!.id } }),
        );
        await onBeaconsChanged();
        await audit(req, {
          action: "BEACON_UPDATE",
          entity: "Beacon",
          entityId: id,
          meta: {
            clave: beaconKey(d.major, d.minor),
            claveAnterior: beaconKey(antes.major, antes.minor),
            campos: changedFields(antes, d),
          },
        });
        res.json({
          beacon: {
            ...beacon,
            clave: beaconKey(beacon.major, beacon.minor),
            completo: isComplete(beacon),
          },
        });
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "delete",
      path: "/beacons/:id",
      handler: async (req, res) => {
        const id = idParam(req, "El beacon");
        const antes = await db.beacon.findUnique({ where: { id } });
        if (!antes) throw notFound("El beacon");
        await db.beacon.delete({ where: { id } });
        await onBeaconsChanged();
        await audit(req, {
          action: "BEACON_DELETE",
          entity: "Beacon",
          entityId: id,
          meta: { clave: beaconKey(antes.major, antes.minor), titulo: antes.titulo },
        });
        res.status(204).end();
      },
    },
  ];
}
