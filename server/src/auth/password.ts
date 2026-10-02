import { hash, verify } from "@node-rs/argon2";

// argon2id con los parámetros mínimos recomendados por OWASP (19 MiB, t=2, p=1).
const OPCIONES = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const PASSWORD_MIN_LENGTH = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPCIONES);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}
