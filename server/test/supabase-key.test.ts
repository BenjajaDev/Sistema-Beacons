import { describe, expect, it } from "vitest";
import {
  cabecerasDeSupabase,
  clasificarClaveSupabase,
  problemaDeClaveDeServidor,
} from "../src/config/supabase-key.js";
import { testEnv } from "./helpers/env.js";

// JWT de forma válida (sin firma real): solo importa el rol de la carga.
const jwtConRol = (role: string) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ iss: "supabase", role })).toString("base64url"),
    "firma",
  ].join(".");

const SECRETA = "sb_secret_clave-de-prueba-0123456789";
const PUBLICA = "sb_publishable_clave-de-prueba-0123456789";

describe("claves de Supabase", () => {
  it("reconoce cada tipo de clave", () => {
    expect(clasificarClaveSupabase(SECRETA)).toEqual({ tipo: "secreta" });
    expect(clasificarClaveSupabase(PUBLICA)).toEqual({ tipo: "publica" });
    expect(clasificarClaveSupabase(jwtConRol("service_role"))).toEqual({
      tipo: "jwt",
      rol: "service_role",
    });
    expect(clasificarClaveSupabase("eyJ.no-es-json.x")).toEqual({ tipo: "jwt", rol: null });
    expect(clasificarClaveSupabase("otra-cosa-de-veinte-caracteres")).toEqual({
      tipo: "desconocida",
    });
  });

  it("la secret key va solo en apikey: como Bearer, Storage responde «Invalid Compact JWS»", () => {
    expect(cabecerasDeSupabase(SECRETA)).toEqual({ apikey: SECRETA });
  });

  it("la service_role heredada va en apikey y como Bearer", () => {
    const clave = jwtConRol("service_role");
    expect(cabecerasDeSupabase(clave)).toEqual({ apikey: clave, Authorization: `Bearer ${clave}` });
  });

  it("rechaza las claves que no pueden subir imágenes, sin mostrarlas", () => {
    expect(problemaDeClaveDeServidor(SECRETA)).toBeNull();
    expect(problemaDeClaveDeServidor(jwtConRol("service_role"))).toBeNull();
    const publica = problemaDeClaveDeServidor(PUBLICA);
    expect(publica).toContain("publishable");
    expect(publica).not.toContain(PUBLICA);
    expect(problemaDeClaveDeServidor(jwtConRol("anon"))).toContain("rol «anon»");
  });

  it("el servidor no arranca con la clave anon ni con una URL de Storage con ruta", () => {
    const base = { STORAGE_DRIVER: "supabase", SUPABASE_URL: "https://ref.supabase.co" };
    expect(() => testEnv({ ...base, SUPABASE_SERVICE_ROLE_KEY: jwtConRol("anon") })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
    expect(() =>
      testEnv({
        ...base,
        SUPABASE_URL: "https://ref.storage.supabase.co/storage/v1/s3",
        SUPABASE_SERVICE_ROLE_KEY: SECRETA,
      }),
    ).toThrow(/SUPABASE_URL/);
    expect(
      testEnv({ ...base, SUPABASE_SERVICE_ROLE_KEY: ` ${SECRETA}\n` }).SUPABASE_SERVICE_ROLE_KEY,
    ).toBe(SECRETA);
  });
});
