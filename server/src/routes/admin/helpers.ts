import type { Request } from "express";
import { z } from "zod";
import { ApiError, notFound } from "../../http/errors.js";

// Una imagen asociada (foto, logo, portada) exige texto alternativo y que el archivo exista.
export async function assertImage(
  db: { media: { findUnique(a: { where: { id: string } }): Promise<unknown> } },
  imagen: { id: string | null | undefined; alt: string | null | undefined },
  campos: { id: string; alt: string },
) {
  if (!imagen.id) return;
  if (!imagen.alt?.trim()) {
    throw new ApiError(400, "VALIDATION", "Revisa los campos marcados.", {
      campos: { [campos.alt]: "Describe la imagen (texto alternativo): es obligatorio." },
    });
  }
  if (!(await db.media.findUnique({ where: { id: imagen.id } }))) {
    throw new ApiError(400, "VALIDATION", "Revisa los campos marcados.", {
      campos: { [campos.id]: "La imagen elegida ya no existe. Sube otra." },
    });
  }
}

// Lee :id como UUID. Un id mal formado es un 404, igual que uno inexistente.
export function idParam(req: Request, que: string, nombre = "id"): string {
  const r = z.uuid().safeParse(req.params[nombre]);
  if (!r.success) throw notFound(que);
  return r.data;
}

// Nombres de los campos que cambian entre dos versiones, para la bitácora.
export function changedFields(antes: Record<string, unknown>, despues: Record<string, unknown>) {
  return Object.keys(despues).filter(
    (k) => despues[k] !== undefined && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]),
  );
}

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.uuid().optional(),
});

// Paginación por cursor: pide un elemento extra para saber si hay más.
export function page<T extends { id: string }>(filas: T[], limit: number) {
  const hayMas = filas.length > limit;
  const items = hayMas ? filas.slice(0, limit) : filas;
  return { items, nextCursor: hayMas ? items.at(-1)!.id : null };
}

export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const urlHttps = z
  .string()
  .trim()
  .regex(/^https:\/\/[^\s<>"]+$/, "Usa una dirección que empiece con https://.")
  .max(500);
