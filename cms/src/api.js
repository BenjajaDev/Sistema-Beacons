// Capa de acceso al backend Express (server/server.js).
// En desarrollo, Vite redirige /beacons -> http://localhost:3000 (ver vite.config.js).

const BASE = "/beacons";

async function manejarRespuesta(res) {
  if (!res.ok) {
    let detalle = "";
    try {
      const data = await res.json();
      detalle = data.error || "";
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(detalle || `Error ${res.status}`);
  }
  return res.json();
}

// Devuelve todos los beacons como objeto { "major-minor": { ... } }
export async function listarBeacons() {
  const res = await fetch(BASE);
  return manejarRespuesta(res);
}

// Crea o actualiza un beacon.
export async function guardarBeacon(major, minor, info) {
  const res = await fetch(`${BASE}/${major}/${minor}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(info),
  });
  return manejarRespuesta(res);
}

// Borra un beacon.
export async function borrarBeacon(major, minor) {
  const res = await fetch(`${BASE}/${major}/${minor}`, { method: "DELETE" });
  return manejarRespuesta(res);
}
