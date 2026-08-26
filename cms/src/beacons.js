// Reglas de negocio compartidas sobre la ficha de un beacon.

// Una ficha se considera completa si tiene título, descripción y ubicación:
// son los tres campos que la app muestra al detectar el beacon.
export function estaCompleto(info) {
  return Boolean(info?.titulo?.trim() && info?.descripcion?.trim() && info?.ubicacion?.trim());
}