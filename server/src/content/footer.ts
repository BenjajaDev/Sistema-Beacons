import { z } from "zod";
import { imagenSchema } from "./image-schema.js";

// Contenido editable del pie de página. Los datos de contacto, las redes y la
// declaración de accesibilidad siguen en sus columnas de SiteSettings; aquí van
// los textos y enlaces propios del pie y qué bloques se muestran.

// Enlaces: rutas internas ("/contacto"), anclas ("#que-es") o https.
const href = z
  .string()
  .trim()
  .regex(
    /^(\/[^\s]*|#[\w-]+|https:\/\/[^\s]+)$/,
    "Usa una ruta (/contacto), un ancla (#seccion) o un enlace https://.",
  );

const texto = (max: number, mensaje: string) => z.string().trim().min(1, mensaje).max(max);

export const footerSchema = z.object({
  // Logo sobre el nombre del sitio (sin él, el isotipo vectorial) e imagen bajo
  // la descripción. El servidor completa su URL y tamaño (section-images.ts).
  logo: imagenSchema.optional(),
  imagen: imagenSchema.optional(),
  descripcion: z.string().trim().max(300).optional(),
  columnas: z
    .array(
      z.object({
        titulo: texto(60, "Escribe el título de la columna."),
        enlaces: z
          .array(z.object({ texto: texto(40, "Escribe el texto del enlace."), href }))
          .min(1, "Cada columna necesita al menos un enlace.")
          .max(6, "Cada columna admite hasta 6 enlaces."),
      }),
    )
    .max(3, "El pie admite hasta 3 columnas de enlaces."),
  mostrarContacto: z.boolean(),
  mostrarRedes: z.boolean(),
  mostrarAccesibilidad: z.boolean(),
  textoLegal: z.string().trim().max(200).optional(),
});

export type Footer = z.infer<typeof footerSchema>;

// Imagen del pie tal como queda guardada: además de lo que envía el panel, la
// URL y el tamaño que agrega el servidor.
type ImagenGuardada = z.infer<typeof imagenSchema> & {
  url?: string;
  width?: number | null;
  height?: number | null;
};
export type FooterGuardado = Omit<Footer, "logo" | "imagen"> & {
  logo?: ImagenGuardada;
  imagen?: ImagenGuardada;
};

export const DEFAULT_FOOTER: Footer = {
  descripcion:
    "Navegación interior con beacons Bluetooth y mensajes de voz para personas con discapacidad visual.",
  columnas: [
    {
      titulo: "Explora",
      enlaces: [
        { texto: "Inicio", href: "/" },
        { texto: "Nosotros", href: "/nosotros" },
        { texto: "Noticias", href: "/noticias" },
        { texto: "Contacto", href: "/contacto" },
      ],
    },
  ],
  mostrarContacto: true,
  mostrarRedes: true,
  mostrarAccesibilidad: true,
};

// Lo guardado en la base, o el pie por defecto si no es válido (no debería pasar).
// El esquema descarta la URL y el tamaño de las imágenes: se recuperan de lo guardado.
export function parseFooter(valor: unknown): FooterGuardado {
  const r = footerSchema.safeParse(valor);
  if (!r.success) return DEFAULT_FOOTER;
  const guardado = valor as Partial<Record<"logo" | "imagen", ImagenGuardada>>;
  return {
    ...r.data,
    ...(r.data.logo && { logo: { ...guardado.logo, ...r.data.logo } }),
    ...(r.data.imagen && { imagen: { ...guardado.imagen, ...r.data.imagen } }),
  };
}
