import { randomBytes } from "node:crypto";
import { z } from "zod";
import { hashPassword } from "../../auth/password.js";
import { Prisma } from "../../generated/prisma/client.js";
import { ApiError, notFound, parseOrThrow } from "../../http/errors.js";
import type { AdminDeps } from "./deps.js";
import { changedFields, idParam } from "./helpers.js";
import { ADMIN_ONLY, type AdminRoute } from "./registry.js";

// Gestión de cuentas. No hay registro público: las cuentas las crea un admin con
// una contraseña temporal que la persona debe cambiar al entrar.

const role = z.enum(["ADMIN", "EDITOR"], "Elige un rol.");

const createSchema = z.object({
  email: z.email("Escribe un correo válido.").transform((e) => e.trim().toLowerCase()),
  name: z.string("Escribe el nombre.").trim().min(1, "Escribe el nombre.").max(120),
  role,
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1, "Escribe el nombre.").max(120),
    role,
    active: z.boolean(),
  })
  .partial();

const PUBLIC_USER = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  mustChangePassword: true,
  lastLoginAt: true,
  lockedUntil: true,
  createdAt: true,
} as const;

// 16 caracteres aleatorios (96 bits). Se muestra una sola vez a quien la genera.
const temporaryPassword = () => randomBytes(12).toString("base64url");

export function userRoutes({ db, audit }: AdminDeps): AdminRoute[] {
  async function cargar(id: string) {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw notFound("La cuenta");
    return user;
  }

  return [
    {
      roles: ADMIN_ONLY,
      method: "get",
      path: "/users",
      handler: async (_req, res) => {
        const items = await db.user.findMany({
          select: PUBLIC_USER,
          orderBy: [{ active: "desc" }, { name: "asc" }],
        });
        res.json({ items });
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "post",
      path: "/users",
      handler: async (req, res) => {
        const d = parseOrThrow(createSchema, req.body);
        const clave = temporaryPassword();
        try {
          const user = await db.user.create({
            data: { ...d, passwordHash: await hashPassword(clave), mustChangePassword: true },
            select: PUBLIC_USER,
          });
          await audit(req, {
            action: "USER_CREATE",
            entity: "User",
            entityId: user.id,
            meta: { role: d.role },
          });
          res.status(201).json({ user, temporaryPassword: clave });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new ApiError(409, "VALIDATION", "Revisa los campos marcados.", {
              campos: { email: "Ya existe una cuenta con este correo." },
            });
          }
          throw err;
        }
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "patch",
      path: "/users/:id",
      handler: async (req, res) => {
        const id = idParam(req, "La cuenta");
        const antes = await cargar(id);
        const d = parseOrThrow(updateSchema, req.body);
        const esUnoMismo = id === req.user!.id;

        if (esUnoMismo && (d.active === false || (d.role && d.role !== antes.role))) {
          throw new ApiError(
            409,
            "SELF_LOCKOUT",
            "No puedes desactivar tu propia cuenta ni quitarte el rol de administrador. Pídeselo a otra persona administradora.",
          );
        }
        const dejaDeSerAdmin =
          antes.role === "ADMIN" && antes.active && (d.active === false || d.role === "EDITOR");

        const user = await db.$transaction(async (tx) => {
          if (dejaDeSerAdmin) {
            // FOR UPDATE bloquea las filas de admins: si dos admins se quitan el rol
            // mutuamente al mismo tiempo, la segunda petición espera y ve el cambio de la primera.
            const admins = await tx.$queryRaw<{ id: string }[]>`
              SELECT id FROM users WHERE role = 'ADMIN' AND active FOR UPDATE`;
            if (admins.length <= 1) {
              throw new ApiError(
                409,
                "LAST_ADMIN",
                "Esta es la única cuenta administradora activa. Crea o activa otra antes de cambiarla.",
              );
            }
          }
          return tx.user.update({
            where: { id },
            data: {
              ...d,
              // Desactivar corta de inmediato todas sus sesiones.
              ...(d.active === false && { tokenVersion: { increment: 1 } }),
            },
            select: PUBLIC_USER,
          });
        });
        await audit(req, {
          action: d.active === false ? "USER_DEACTIVATE" : "USER_UPDATE",
          entity: "User",
          entityId: id,
          meta: { campos: changedFields(antes, d) },
        });
        res.json({ user });
      },
    },
    {
      roles: ADMIN_ONLY,
      method: "post",
      path: "/users/:id/reset-password",
      handler: async (req, res) => {
        const id = idParam(req, "La cuenta");
        await cargar(id);
        if (id === req.user!.id) {
          throw new ApiError(409, "SELF_RESET", "Para tu propia cuenta usa «Cambiar contraseña».");
        }
        const clave = temporaryPassword();
        const user = await db.user.update({
          where: { id },
          data: {
            passwordHash: await hashPassword(clave),
            mustChangePassword: true,
            tokenVersion: { increment: 1 },
            failedLogins: 0,
            lockedUntil: null,
          },
          select: PUBLIC_USER,
        });
        await audit(req, { action: "USER_PASSWORD_RESET", entity: "User", entityId: id });
        res.json({ user, temporaryPassword: clave });
      },
    },
    {
      // Elimina una cuenta sin contenido asociado. Las que firmaron noticias, borradores,
      // imágenes o beacons se desactivan en su lugar, para no perder la autoría. Sus
      // entradas de la bitácora se conservan sin persona (onDelete: SetNull).
      roles: ADMIN_ONLY,
      method: "delete",
      path: "/users/:id",
      handler: async (req, res) => {
        const id = idParam(req, "La cuenta");
        const antes = await cargar(id);
        if (id === req.user!.id) {
          throw new ApiError(409, "SELF_DELETE", "No puedes eliminar tu propia cuenta.");
        }
        const [noticias, borradores, imagenes, beacons] = await Promise.all([
          db.news.count({ where: { OR: [{ authorId: id }, { reviewerId: id }] } }),
          db.section.count({ where: { draftAuthorId: id } }),
          db.media.count({ where: { uploadedById: id } }),
          db.beacon.count({ where: { updatedById: id } }),
        ]);
        if (noticias + borradores + imagenes + beacons > 0) {
          throw new ApiError(
            409,
            "USER_HAS_CONTENT",
            "Esta cuenta tiene noticias, borradores, imágenes o beacons a su nombre. Desactívala para quitarle el acceso sin perder la autoría.",
          );
        }
        await db.$transaction(async (tx) => {
          if (antes.role === "ADMIN" && antes.active) {
            const admins = await tx.$queryRaw<{ id: string }[]>`
              SELECT id FROM users WHERE role = 'ADMIN' AND active FOR UPDATE`;
            if (admins.length <= 1) {
              throw new ApiError(
                409,
                "LAST_ADMIN",
                "Esta es la única cuenta administradora activa. Crea o activa otra antes de eliminarla.",
              );
            }
          }
          await tx.user.delete({ where: { id } });
        });
        await audit(req, {
          action: "USER_DELETE",
          entity: "User",
          entityId: id,
          meta: { email: antes.email },
        });
        res.status(204).end();
      },
    },
  ];
}
