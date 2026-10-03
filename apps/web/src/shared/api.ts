// Cliente HTTP común. Convierte cualquier falla en un ApiError con un mensaje
// que dice qué pasó y qué hacer, listo para mostrar en un aviso o junto al campo.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    // Errores por campo: { "email": "Escribe un correo válido." }
    readonly campos: Record<string, string> = {},
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const MENSAJES_POR_ESTADO: Record<number, string> = {
  401: "Tu sesión expiró. Vuelve a iniciar sesión.",
  403: "No tienes permiso para hacer esta acción.",
  404: "No encontramos lo que buscas. Puede que se haya movido o eliminado.",
  413: "El archivo es demasiado grande.",
  429: "Hiciste muchas solicitudes seguidas. Espera un momento e intenta de nuevo.",
};

const SIN_CONEXION =
  "No hay conexión con el servidor. Revisa tu conexión a internet e intenta de nuevo.";
const ERROR_SERVIDOR =
  "El servidor tuvo un problema. Intenta de nuevo en unos minutos; si persiste, avísanos.";

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function apiFetch<T>(url: string, opciones: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, signal } = opciones;
  const esFormData = typeof FormData !== "undefined" && body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !esFormData && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : esFormData ? body : JSON.stringify(body),
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK", SIN_CONEXION);
  }

  if (res.status === 204) return undefined as T;

  let datos: Record<string, unknown> = {};
  try {
    datos = await res.json();
  } catch {
    // Respuesta sin JSON (por ejemplo, un proxy caído).
  }

  if (!res.ok) {
    const { error, code, campos, ...extra } = datos as {
      error?: string;
      code?: string;
      campos?: Record<string, string>;
    };
    const mensaje =
      error ??
      MENSAJES_POR_ESTADO[res.status] ??
      (res.status >= 500 ? ERROR_SERVIDOR : SIN_CONEXION);
    throw new ApiError(res.status, code ?? `HTTP_${res.status}`, mensaje, campos ?? {}, extra);
  }
  return datos as T;
}

export function mensajeDeError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Ocurrió un error inesperado. Recarga la página e intenta de nuevo.";
}
