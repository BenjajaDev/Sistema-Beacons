// Un módulo que se carga al entrar a una vista puede haber dejado de existir: hubo
// un build nuevo (los nombres llevan hash) o, en desarrollo, Vite re-optimizó sus
// dependencias. Sin esto la pestaña queda en «Failed to fetch dynamically imported
// module» hasta que alguien recarga a mano. Se recarga sola una vez; la marca con la
// hora evita un bucle si la falla es otra (por ejemplo, sin conexión).

const CLAVE = "signal-recarga-modulos";
const VENTANA_MS = 10_000;

function recargarUnaVez(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE));
    if (ultima && Date.now() - ultima < VENTANA_MS) return false;
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    // Sin sessionStorage no hay cómo evitar un bucle: se deja ver el error.
    return false;
  }
  window.location.reload();
  return true;
}

export async function importarConRecarga<T>(cargar: () => Promise<T>): Promise<T> {
  try {
    return await cargar();
  } catch (err) {
    // La página se está recargando: la promesa queda pendiente para no mostrar el error.
    if (recargarUnaVez()) return new Promise<T>(() => {});
    throw err;
  }
}

// Precargas que Vite agrega en el build (CSS y chunks compartidos de cada vista).
export function recargarSiFaltanModulos() {
  window.addEventListener("vite:preloadError", (evento) => {
    if (recargarUnaVez()) evento.preventDefault();
  });
}
