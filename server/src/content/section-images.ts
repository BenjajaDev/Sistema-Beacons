import { ApiError } from "../http/errors.js";

// Imágenes dentro del JSON de una sección. El panel envía { mediaId, alt,
// decorativa }; el servidor guarda además la URL y el tamaño leídos de la
// biblioteca, nunca los que manda el navegador. Así:
//  - la landing no consulta la tabla media para dibujar una sección;
//  - el chequeo «la imagen está en uso» (por URL) protege también las secciones.

export interface ImagenGuardada {
  mediaId: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
  decorativa: boolean;
}

// Lo que llega a la landing: sin ids internos.
export interface ImagenPublica {
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}

interface Biblioteca {
  media: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; url: true; width: true; height: true };
    }): Promise<{ id: string; url: string; width: number | null; height: number | null }[]>;
  };
}

type ImagenEntrada = { mediaId: string; alt: string; decorativa: boolean };

function esImagen(valor: unknown): valor is ImagenEntrada {
  return (
    typeof valor === "object" &&
    valor !== null &&
    typeof (valor as { mediaId?: unknown }).mediaId === "string"
  );
}

// Recorre el contenido y aplica `f` a cada imagen, con su ruta («pasos.1.imagen»).
function mapearImagenes(
  valor: unknown,
  f: (imagen: ImagenEntrada, ruta: string) => unknown,
  ruta = "",
): unknown {
  if (esImagen(valor)) return f(valor, ruta);
  const unir = (k: string | number) => (ruta ? `${ruta}.${k}` : String(k));
  if (Array.isArray(valor)) return valor.map((v, i) => mapearImagenes(v, f, unir(i)));
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, mapearImagenes(v, f, unir(k))]),
    );
  }
  return valor;
}

// Completa cada imagen con su URL y tamaño. Una imagen borrada de la biblioteca
// es un error de validación en su campo.
export async function resolveSectionImages<T>(db: Biblioteca, contenido: T): Promise<T> {
  const ids = new Set<string>();
  mapearImagenes(contenido, (img) => ids.add(img.mediaId));
  if (ids.size === 0) return contenido;

  const filas = await db.media.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, url: true, width: true, height: true },
  });
  const porId = new Map(filas.map((m) => [m.id, m]));
  const faltantes: Record<string, string> = {};

  const resuelto = mapearImagenes(contenido, (img, ruta): ImagenGuardada | ImagenEntrada => {
    const media = porId.get(img.mediaId);
    if (!media) {
      faltantes[`${ruta}.mediaId`] =
        "La imagen elegida ya no existe. Sube otra o elige una distinta.";
      return img;
    }
    return {
      mediaId: media.id,
      url: media.url,
      width: media.width,
      height: media.height,
      alt: img.decorativa ? "" : img.alt,
      decorativa: img.decorativa,
    };
  });
  if (Object.keys(faltantes).length) {
    throw new ApiError(400, "VALIDATION", "Revisa los campos marcados.", { campos: faltantes });
  }
  return resuelto as T;
}

// Para la landing: quita el id y la marca de decorativa (el alt vacío ya lo dice).
export function publicSectionImages(contenido: unknown): unknown {
  return mapearImagenes(contenido, (img): ImagenPublica => {
    const guardada = img as Partial<ImagenGuardada>;
    return {
      url: guardada.url ?? "",
      width: guardada.width ?? null,
      height: guardada.height ?? null,
      alt: img.decorativa ? "" : img.alt,
    };
  });
}
