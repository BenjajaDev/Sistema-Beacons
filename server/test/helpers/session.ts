import type { Express } from "express";
import request from "supertest";

export interface TestSession {
  cookie: string;
  csrfToken: string;
}

// Convierte los Set-Cookie de una respuesta en una cabecera Cookie. Se hace a mano
// porque el cliente de supertest no reenvía cookies Secure por http.
export function cookieHeader(setCookie: string | string[] | undefined): string {
  const lista = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return lista
    .map((c) => c.split(";")[0]!)
    .filter((c) => !c.endsWith("="))
    .join("; ");
}

export async function login(app: Express, email: string, password: string): Promise<TestSession> {
  const res = await request(app).post("/api/admin/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { cookie: cookieHeader(res.headers["set-cookie"]), csrfToken: res.body.csrfToken };
}

// Petición autenticada; en métodos que modifican, incluye el token CSRF.
export function as(
  app: Express,
  s: TestSession,
  method: "get" | "post" | "put" | "patch" | "delete",
  url: string,
) {
  const req = request(app)[method](url).set("Cookie", s.cookie);
  return method === "get" ? req : req.set("X-CSRF-Token", s.csrfToken);
}
