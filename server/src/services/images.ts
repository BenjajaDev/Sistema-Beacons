import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import sharp, { type OutputInfo } from "sharp";
import { ApiError } from "../http/errors.js";

// Las subidas se validan por su contenido real (no por la extensión ni por el
// Content-Type que declare el navegador) y se vuelven a codificar con sharp.
// Recodificar elimina los metadatos EXIF (incluida la ubicación GPS de las fotos)
// y cualquier dato extra escondido en el archivo.

const PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const ANCHO_MAXIMO = 2400;
// Evita archivos diminutos que se expanden a imágenes gigantes en memoria.
const PIXELES_MAXIMOS = 40_000_000;

export interface ProcessedImage {
  key: string;
  data: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

export async function processImage(original: Buffer): Promise<ProcessedImage> {
  const tipo = await fileTypeFromBuffer(original);
  if (!tipo || !PERMITIDOS.has(tipo.mime)) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA",
      "El archivo no es una imagen compatible. Sube un JPG, PNG, WebP o AVIF.",
    );
  }

  let imagen = sharp(original, { limitInputPixels: PIXELES_MAXIMOS, failOn: "error" })
    .rotate() // aplica la orientación EXIF antes de descartarla
    .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true });

  // PNG se mantiene (logos con transparencia, íconos); el resto pasa a WebP.
  const esPng = tipo.mime === "image/png";
  imagen = esPng ? imagen.png({ compressionLevel: 9 }) : imagen.webp({ quality: 82 });

  let resultado: { data: Buffer; info: OutputInfo };
  try {
    resultado = await imagen.toBuffer({ resolveWithObject: true });
  } catch {
    throw new ApiError(
      422,
      "INVALID_IMAGE",
      "No se pudo procesar la imagen: el archivo parece dañado o es demasiado grande. Prueba con otra.",
    );
  }

  const fecha = new Date();
  const carpeta = `${fecha.getUTCFullYear()}/${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
  const extension = esPng ? "png" : "webp";
  return {
    key: `${carpeta}/${randomUUID()}.${extension}`,
    data: resultado.data,
    mimeType: esPng ? "image/png" : "image/webp",
    width: resultado.info.width,
    height: resultado.info.height,
  };
}

export interface AreaRecorte {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Recorta una imagen ya guardada (procesada por processImage: sin EXIF y con la
// orientación aplicada) y la devuelve como una imagen nueva del mismo formato.
export async function cropImage(
  guardada: Buffer,
  mimeType: string,
  area: AreaRecorte,
): Promise<ProcessedImage> {
  const imagen = sharp(guardada, { limitInputPixels: PIXELES_MAXIMOS, failOn: "error" });
  const { width = 0, height = 0 } = await imagen.metadata();
  if (area.x + area.width > width || area.y + area.height > height) {
    throw new ApiError(
      400,
      "VALIDATION",
      "El recorte se sale de la imagen. Vuelve a ajustarlo e inténtalo otra vez.",
    );
  }
  const esPng = mimeType === "image/png";
  const recortada = imagen.extract({
    left: area.x,
    top: area.y,
    width: area.width,
    height: area.height,
  });
  const { data, info } = await (
    esPng ? recortada.png({ compressionLevel: 9 }) : recortada.webp({ quality: 82 })
  ).toBuffer({ resolveWithObject: true });

  const fecha = new Date();
  const carpeta = `${fecha.getUTCFullYear()}/${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    key: `${carpeta}/${randomUUID()}.${esPng ? "png" : "webp"}`,
    data,
    mimeType: esPng ? "image/png" : "image/webp",
    width: info.width,
    height: info.height,
  };
}
