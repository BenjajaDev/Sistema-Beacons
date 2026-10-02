import type { Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "../../auth/password.js";
import { ApiError, parseOrThrow, unauthenticated } from "../../http/errors.js";
import type { AdminDeps } from "./deps.js";
import { ANY_ROLE, type AdminRoute } from "./registry.js";

const PASSWORD_MAX_LENGTH = 256;

const loginSchema = z.object({
  email: z.string("Escribe tu correo.").trim().min(1, "Escribe tu correo.").max(320),
  password: z
    .string("Escribe tu contraseña.")
    .min(1, "Escribe tu contraseña.")
    .max(PASSWORD_MAX_LENGTH),
});

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string("Escribe tu contraseña actual.")
      .min(1, "Escribe tu contraseña actual."),
    newPassword: z
      .string("Escribe la nueva contraseña.")
      .min(
        PASSWORD_MIN_LENGTH,
        `La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
      )
      .max(
        PASSWORD_MAX_LENGTH,
        `La nueva contraseña no puede superar ${PASSWORD_MAX_LENGTH} caracteres.`,
      ),
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "La nueva contraseña debe ser distinta de la actual.",
  });

const INVALID_CREDENTIALS = () =>
  new ApiError(
    401,
    "INVALID_CREDENTIALS",
    "Correo o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.",
  );

function accountLocked(hasta: Date) {
  const minutos = Math.max(1, Math.ceil((hasta.getTime() - Date.now()) / 60_000));
  return new ApiError(
    429,
    "ACCOUNT_LOCKED",
    `Tu cuenta está bloqueada temporalmente por varios intentos fallidos. Intenta de nuevo en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`,
    { reintentarEnMinutos: minutos },
  );
}

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
  };
}

// Hash de referencia para que un correo inexistente tarde lo mismo que una
// contraseña incorrecta y no se pueda averiguar qué cuentas existen.
let hashFicticio: Promise<string> | undefined;
const dummyHash = () => (hashFicticio ??= hashPassword("contraseña-ficticia-para-igualar-tiempos"));

async function startSession(
  deps: AdminDeps,
  req: Request,
  res: Response,
  user: { id: string; tokenVersion: number },
) {
  const { jti } = await deps.sessions.issue(res, user);
  // El token CSRF se ata a la sesión nueva.
  req.sessionId = jti;
  return deps.csrf.generateCsrfToken(req, res, { overwrite: true });
}

export function loginHandler(deps: AdminDeps): RequestHandler {
  const { db, env, audit } = deps;
  return async (req, res) => {
    const { email: emailCrudo, password } = parseOrThrow(loginSchema, req.body);
    const email = emailCrudo.toLowerCase();
    const user = await db.user.findUnique({ where: { email } });
    const ahora = new Date();

    if (user?.lockedUntil && user.lockedUntil > ahora) {
      await audit(req, {
        action: "LOGIN_BLOCKED",
        entity: "User",
        entityId: user.id,
        userId: user.id,
      });
      throw accountLocked(user.lockedUntil);
    }

    const valida =
      user && user.active
        ? await verifyPassword(user.passwordHash, password)
        : (await verifyPassword(await dummyHash(), password), false);

    if (!user || !user.active || !valida) {
      if (user?.active) {
        const { failedLogins } = await db.user.update({
          where: { id: user.id },
          data: { failedLogins: { increment: 1 } },
          select: { failedLogins: true },
        });
        if (failedLogins >= env.LOGIN_MAX_ATTEMPTS) {
          const hasta = new Date(ahora.getTime() + env.LOGIN_LOCK_MINUTES * 60_000);
          await db.user.update({
            where: { id: user.id },
            data: { lockedUntil: hasta, failedLogins: 0 },
          });
          await audit(req, {
            action: "ACCOUNT_LOCKED",
            entity: "User",
            entityId: user.id,
            userId: user.id,
          });
          throw accountLocked(hasta);
        }
      }
      await audit(req, {
        action: "LOGIN_FAIL",
        entity: "User",
        entityId: user?.id,
        userId: user?.id ?? null,
        meta: { email },
      });
      throw INVALID_CREDENTIALS();
    }

    const actualizado = await db.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: ahora },
    });
    const csrfToken = await startSession(deps, req, res, actualizado);
    await audit(req, { action: "LOGIN_OK", entity: "User", entityId: user.id, userId: user.id });
    res.json({ user: publicUser(actualizado), csrfToken });
  };
}

export function authRoutes(deps: AdminDeps): AdminRoute[] {
  const { db, audit, sessions } = deps;
  const pendiente = { roles: ANY_ROLE, allowPendingPasswordChange: true } as const;

  return [
    {
      ...pendiente,
      method: "get",
      path: "/auth/me",
      handler: (req, res) => {
        res.json({ user: req.user });
      },
    },
    {
      // Entrega un token CSRF para la sesión actual (por ejemplo, tras recargar el panel).
      ...pendiente,
      method: "get",
      path: "/auth/csrf",
      handler: (req, res) => {
        res.json({ csrfToken: deps.csrf.generateCsrfToken(req, res) });
      },
    },
    {
      // Cierra la sesión en todos los dispositivos: invalida todos los tokens emitidos.
      ...pendiente,
      method: "post",
      path: "/auth/logout",
      handler: async (req, res) => {
        await db.user.update({
          where: { id: req.user!.id },
          data: { tokenVersion: { increment: 1 } },
        });
        sessions.clear(res);
        await audit(req, { action: "LOGOUT", entity: "User", entityId: req.user!.id });
        res.status(204).end();
      },
    },
    {
      ...pendiente,
      method: "post",
      path: "/auth/change-password",
      handler: async (req, res) => {
        const { currentPassword, newPassword } = parseOrThrow(changePasswordSchema, req.body);
        const user = await db.user.findUnique({ where: { id: req.user!.id } });
        if (!user) throw unauthenticated();
        if (!(await verifyPassword(user.passwordHash, currentPassword))) {
          throw new ApiError(400, "VALIDATION", "Revisa los campos marcados.", {
            campos: { currentPassword: "La contraseña actual no es correcta." },
          });
        }
        if (newPassword.toLowerCase().includes(user.email.split("@")[0]!.toLowerCase())) {
          throw new ApiError(400, "VALIDATION", "Revisa los campos marcados.", {
            campos: { newPassword: "La nueva contraseña no debe contener tu correo." },
          });
        }
        // Sube la versión: las demás sesiones abiertas se cierran y esta recibe un token nuevo.
        const actualizado = await db.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await hashPassword(newPassword),
            mustChangePassword: false,
            tokenVersion: { increment: 1 },
          },
        });
        const csrfToken = await startSession(deps, req, res, actualizado);
        await audit(req, { action: "PASSWORD_CHANGE", entity: "User", entityId: user.id });
        res.json({ user: publicUser(actualizado), csrfToken });
      },
    },
  ];
}
