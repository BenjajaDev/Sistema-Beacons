// Supabase tiene dos generaciones de claves y se envían distinto:
//
// - Heredadas (JWT, empiezan con «eyJ»): van en `apikey` y como `Authorization: Bearer`.
//   Solo la de rol `service_role` puede subir y borrar archivos; la `anon` no.
// - Nuevas (`sb_secret_…` y `sb_publishable_…`): no son JWT. Van SOLO en `apikey`;
//   si se mandan como Bearer, Storage responde «Invalid Compact JWS».
//   Solo la secreta tiene permisos de servidor.

export type ClaveSupabase =
  | { tipo: "secreta" }
  | { tipo: "jwt"; rol: string | null }
  | { tipo: "publica" }
  | { tipo: "desconocida" };

export function clasificarClaveSupabase(clave: string): ClaveSupabase {
  if (clave.startsWith("sb_secret_")) return { tipo: "secreta" };
  if (clave.startsWith("sb_publishable_")) return { tipo: "publica" };
  const partes = clave.split(".");
  if (partes.length === 3 && clave.startsWith("eyJ"))
    return { tipo: "jwt", rol: rolDelJwt(partes[1]!) };
  return { tipo: "desconocida" };
}

// Lee el rol sin verificar la firma: solo sirve para avisar de una clave equivocada.
function rolDelJwt(carga: string): string | null {
  try {
    const datos: unknown = JSON.parse(Buffer.from(carga, "base64url").toString("utf8"));
    const rol = (datos as { role?: unknown } | null)?.role;
    return typeof rol === "string" ? rol : null;
  } catch {
    return null;
  }
}

// Motivo por el que la clave no sirve para que el servidor suba imágenes, o null si sirve.
// El mensaje nunca incluye la clave.
export function problemaDeClaveDeServidor(clave: string): string | null {
  const c = clasificarClaveSupabase(clave);
  if (c.tipo === "publica") {
    return "SUPABASE_SERVICE_ROLE_KEY tiene la clave publishable (sb_publishable_…), que no puede subir imágenes. Usa la secret key (sb_secret_…) o la service_role heredada.";
  }
  if (c.tipo === "jwt" && c.rol !== "service_role") {
    return `SUPABASE_SERVICE_ROLE_KEY tiene una clave JWT con rol «${c.rol ?? "desconocido"}», que no puede subir imágenes. Usa la service_role o la secret key (sb_secret_…).`;
  }
  return null;
}

// Cabeceras de autenticación para la API REST de Supabase según el tipo de clave.
export function cabecerasDeSupabase(clave: string): Record<string, string> {
  const { tipo } = clasificarClaveSupabase(clave);
  const nueva = tipo === "secreta" || tipo === "publica";
  return nueva ? { apikey: clave } : { apikey: clave, Authorization: `Bearer ${clave}` };
}
