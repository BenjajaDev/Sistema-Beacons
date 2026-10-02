import { randomUUID } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "../generated/prisma/enums.js";

// Sesión: JWT firmado (HS256) en una cookie httpOnly + Secure + SameSite=Strict.
// El token lleva la versión de credenciales del usuario (`ver`); al cambiar la
// contraseña, cerrar sesión o desactivar la cuenta, la versión sube y todos los
// tokens anteriores dejan de valer.

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface SessionConfig {
  jwtSecret: string;
  ttlHours: number;
  secureCookies: boolean;
}

interface Claims {
  sub: string;
  ver: number;
  jti: string;
}

// Con Secure se usa el prefijo __Host-: el navegador exige Secure, Path=/ y sin
// Domain, así que la cookie no se puede pisar desde un subdominio.
export function sessionCookieName(secure: boolean) {
  return secure ? "__Host-signal_session" : "signal_session";
}
export function csrfCookieName(secure: boolean) {
  return secure ? "__Host-signal_csrf" : "signal_csrf";
}

export function baseCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: "strict", path: "/" };
}

export function createSessionService(config: SessionConfig) {
  const key = new TextEncoder().encode(config.jwtSecret);
  const cookieName = sessionCookieName(config.secureCookies);

  async function issue(res: Response, user: { id: string; tokenVersion: number }) {
    const jti = randomUUID();
    const token = await new SignJWT({ ver: user.tokenVersion })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${Math.round(config.ttlHours * 3600)}s`)
      .sign(key);
    res.cookie(cookieName, token, {
      ...baseCookieOptions(config.secureCookies),
      maxAge: config.ttlHours * 3_600_000,
    });
    return { jti };
  }

  async function read(req: Request): Promise<Claims | null> {
    const token: unknown = req.cookies?.[cookieName];
    if (typeof token !== "string" || !token) return null;
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
      if (typeof payload.sub !== "string" || typeof payload.jti !== "string") return null;
      if (typeof payload.ver !== "number") return null;
      return { sub: payload.sub, ver: payload.ver, jti: payload.jti };
    } catch {
      return null;
    }
  }

  function clear(res: Response) {
    res.clearCookie(cookieName, baseCookieOptions(config.secureCookies));
    res.clearCookie(csrfCookieName(config.secureCookies), baseCookieOptions(config.secureCookies));
  }

  return { issue, read, clear, cookieName };
}

export type SessionService = ReturnType<typeof createSessionService>;
