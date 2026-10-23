import { z } from "zod";
import type { Page } from "../generated/prisma/enums.js";
import { imagenSchema } from "./image-schema.js";
import { richTextFromParagraphs, richTextSchema } from "./rich-text.js";

// Catálogo de secciones de la landing. Cada `key` define la forma de su JSON,
// en qué página va, su orden inicial y el contenido con que la crea el seed.
// El panel edita estos campos; la landing no tiene textos fijos en el código.

const texto = (max: number) => z.string().trim().min(1, "Este campo es obligatorio.").max(max);
const textoOpcional = (max: number) => z.string().trim().max(max).optional();

// Enlaces de botones: rutas internas ("/contacto"), anclas ("#que-es") o https.
const href = z
  .string()
  .trim()
  .regex(
    /^(\/[^\s]*|#[\w-]+|https:\/\/[^\s]+)$/,
    "Usa una ruta (/contacto), un ancla (#seccion) o un enlace https://.",
  );

const enlace = z.object({ texto: texto(40), href });

// Audiodescripción de una sección principal: lo que se lee en voz alta al
// presionar «Escuchar esta sección». Vacía, el botón no aparece.
const audiodescripcion = textoOpcional(1200);

export { imagenSchema };

const item = z.object({ titulo: texto(80), texto: texto(400), imagen: imagenSchema.optional() });
const encabezado = {
  titulo: texto(120),
  intro: textoOpcional(400),
  imagen: imagenSchema.optional(),
};

// Bloque de imagen y texto, con la imagen a un lado y un botón opcional.
const imagenTexto = z.object({
  titulo: texto(120),
  texto: texto(1200),
  imagen: imagenSchema.optional(),
  posicion: z.enum(["izquierda", "derecha"]).default("derecha"),
  accion: enlace.optional(),
});

export const sectionSchemas = {
  hero: z.object({
    antetitulo: textoOpcional(60),
    titulo: texto(120),
    bajada: texto(300),
    // Sin imagen, la portada muestra las ondas de la señal.
    imagen: imagenSchema.optional(),
    accionPrincipal: enlace.optional(),
    accionSecundaria: enlace.optional(),
    audiodescripcion,
  }),
  "que-es": z.object({
    ...encabezado,
    pasos: z.array(item).min(1, "Agrega al menos un paso.").max(6, "Hasta 6 pasos."),
    audiodescripcion,
  }),
  objetivos: z.object({ ...encabezado, items: z.array(item).min(1).max(8) }),
  proyecciones: z.object({ ...encabezado, items: z.array(item).min(1).max(8) }),
  // Debajo del texto se muestra la fila del equipo con sus cards.
  "nosotros-inicio": z.object({
    titulo: texto(120),
    texto: texto(600),
    imagen: imagenSchema.optional(),
    accion: enlace.optional(),
    audiodescripcion,
  }),
  "noticias-recientes": z.object({ ...encabezado, textoVerTodas: texto(40) }),
  "quienes-somos": z.object({
    titulo: texto(120),
    cuerpo: richTextSchema,
    imagen: imagenSchema.optional(),
    audiodescripcion,
  }),
  equipo: z.object(encabezado),
  colaboradores: z.object(encabezado),
  noticias: z.object(encabezado),
  contacto: z.object({
    ...encabezado,
    formularioTitulo: texto(80),
    mensajeExito: texto(200),
    audiodescripcion,
  }),
  "imagen-texto-inicio": imagenTexto,
  "imagen-texto-nosotros": imagenTexto,
} as const;

export type SectionKey = keyof typeof sectionSchemas;
export type SectionContent<K extends SectionKey> = z.infer<(typeof sectionSchemas)[K]>;

interface SectionDefinition<K extends SectionKey> {
  page: Page;
  order: number;
  // Nombre que ve quien edita en el panel.
  nombre: string;
  // Las secciones que se agregan al catálogo después nacen ocultas: se muestran
  // cuando alguien completa su contenido.
  visibleInicial?: boolean;
  contenidoInicial: z.input<(typeof sectionSchemas)[K]>;
}

// Contenido inicial: un punto de partida para editar desde el panel, no texto definitivo.
export const SECTION_DEFINITIONS: { [K in SectionKey]: SectionDefinition<K> } = {
  hero: {
    page: "INICIO",
    order: 1,
    nombre: "Portada",
    contenidoInicial: {
      antetitulo: "Navegación interior accesible",
      titulo: "Orientarse en un edificio, con voz y sin barreras",
      bajada:
        "SIGNAL guía a personas con discapacidad visual dentro de espacios interiores con beacons Bluetooth y mensajes de audio en su teléfono.",
      accionPrincipal: { texto: "Cómo funciona", href: "#que-es" },
      accionSecundaria: { texto: "Contáctanos", href: "/contacto" },
      audiodescripcion:
        "Estás en la portada de SIGNAL, un sistema de orientación en interiores para personas con discapacidad visual. Junto al título hay una ilustración de la señal de un beacon: un punto de luz azul que emite ondas. Debajo hay dos botones: uno explica cómo funciona y otro lleva al formulario de contacto.",
    },
  },
  "que-es": {
    page: "INICIO",
    order: 2,
    nombre: "Qué es SIGNAL",
    contenidoInicial: {
      titulo: "Qué es SIGNAL",
      intro: "Un sistema de orientación en tres pasos.",
      pasos: [
        {
          titulo: "Instalamos beacons",
          texto:
            "Pequeños emisores Bluetooth se ubican en puntos clave del edificio: accesos, pasillos y oficinas.",
        },
        {
          titulo: "La app los detecta",
          texto:
            "Al acercarte, la app SIGNAL reconoce el beacon más cercano y estima la distancia.",
        },
        {
          titulo: "Escuchas dónde estás",
          texto: "La app describe el lugar en voz alta e indica cómo llegar al siguiente punto.",
        },
      ],
      audiodescripcion:
        "Esta sección explica cómo funciona SIGNAL en pasos numerados. Primero, se instalan pequeños beacons Bluetooth en puntos clave del edificio. Luego, la app del teléfono detecta el beacon más cercano. Por último, la app describe el lugar en voz alta e indica cómo seguir.",
    },
  },
  objetivos: {
    page: "INICIO",
    order: 3,
    nombre: "Objetivos",
    contenidoInicial: {
      titulo: "Objetivos",
      items: [
        {
          titulo: "Autonomía",
          texto: "Que cada persona pueda desplazarse por un edificio sin depender de asistencia.",
        },
        {
          titulo: "Información clara",
          texto: "Mensajes breves y precisos, pensados para escucharse en movimiento.",
        },
        {
          titulo: "Diseño con las personas usuarias",
          texto: "Probar y ajustar el sistema junto a quienes lo usan todos los días.",
        },
      ],
    },
  },
  proyecciones: {
    page: "INICIO",
    order: 4,
    nombre: "Proyecciones",
    contenidoInicial: {
      titulo: "Proyecciones",
      items: [
        {
          titulo: "Más espacios",
          texto: "Extender la red de beacons a otros edificios y espacios públicos.",
        },
        {
          titulo: "Rutas completas",
          texto: "Pasar de puntos aislados a recorridos guiados de principio a fin.",
        },
      ],
    },
  },
  "nosotros-inicio": {
    page: "INICIO",
    order: 5,
    nombre: "Nosotros (en el inicio)",
    contenidoInicial: {
      titulo: "Quiénes hacen SIGNAL",
      texto:
        "Somos un equipo que diseña la orientación en interiores junto a personas con discapacidad visual: probamos cada mensaje en terreno y lo ajustamos con quienes lo usan.",
      accion: { texto: "Conoce al equipo", href: "/nosotros" },
      audiodescripcion:
        "Presentación del equipo de SIGNAL. Hay un texto breve sobre quiénes somos y, debajo, una fila con la foto circular de cada integrante, su nombre y su cargo. Al activar a una persona se abre una tarjeta con su formación, una breve biografía y su correo.",
    },
  },
  "noticias-recientes": {
    page: "INICIO",
    order: 6,
    nombre: "Últimas noticias",
    contenidoInicial: { titulo: "Últimas noticias", textoVerTodas: "Ver todas las noticias" },
  },
  "quienes-somos": {
    page: "NOSOTROS",
    order: 1,
    nombre: "Quiénes somos",
    contenidoInicial: {
      titulo: "Quiénes somos",
      cuerpo: richTextFromParagraphs([
        "SIGNAL es un proyecto que busca que los espacios interiores sean accesibles para personas con discapacidad visual.",
        "Edita este texto desde el panel para contar la historia del equipo.",
      ]),
      audiodescripcion:
        "Página Nosotros. Cuenta quiénes forman SIGNAL y por qué nació el proyecto: que los espacios interiores sean accesibles para personas con discapacidad visual. Más abajo están las tarjetas del equipo, que se recorren con las flechas del carrusel, y las organizaciones colaboradoras.",
    },
  },
  equipo: {
    page: "NOSOTROS",
    order: 2,
    nombre: "Equipo",
    contenidoInicial: { titulo: "Equipo" },
  },
  colaboradores: {
    page: "NOSOTROS",
    order: 3,
    nombre: "Colaboradores",
    contenidoInicial: { titulo: "Colaboradores" },
  },
  noticias: {
    page: "NOTICIAS",
    order: 1,
    nombre: "Encabezado de noticias",
    contenidoInicial: { titulo: "Noticias", intro: "Novedades del proyecto SIGNAL." },
  },
  contacto: {
    page: "CONTACTO",
    order: 1,
    nombre: "Contacto",
    contenidoInicial: {
      titulo: "Contacto",
      intro: "Escríbenos si quieres llevar SIGNAL a tu edificio o colaborar con el proyecto.",
      formularioTitulo: "Envíanos un mensaje",
      mensajeExito: "Recibimos tu mensaje. Te responderemos a la brevedad.",
      audiodescripcion:
        "Página de contacto. A un lado están el teléfono, el correo y la dirección de SIGNAL; al otro, un formulario con nombre, correo, teléfono opcional, asunto y mensaje. Al enviarlo aparece un aviso de confirmación.",
    },
  },
  "imagen-texto-inicio": {
    page: "INICIO",
    order: 7,
    nombre: "Imagen y texto (inicio)",
    visibleInicial: false,
    contenidoInicial: {
      titulo: "SIGNAL en terreno",
      texto:
        "Cuenta aquí una experiencia, un hito o una instalación, acompañada de una fotografía.",
      posicion: "derecha",
    },
  },
  "imagen-texto-nosotros": {
    page: "NOSOTROS",
    order: 4,
    nombre: "Imagen y texto (nosotros)",
    visibleInicial: false,
    contenidoInicial: {
      titulo: "Cómo trabajamos",
      texto: "Cuenta aquí cómo trabaja el equipo, acompañado de una fotografía.",
      posicion: "izquierda",
    },
  },
};

export function isSectionKey(key: string): key is SectionKey {
  return Object.hasOwn(sectionSchemas, key);
}

export function parseSectionContent<K extends SectionKey>(key: K, content: unknown) {
  return sectionSchemas[key].safeParse(content);
}

// Las bases creadas antes de la audiodescripción no tienen ese campo: mientras
// nadie lo edite, se usa el texto inicial del catálogo. Si alguien lo deja vacío
// a propósito, queda "" y no se reemplaza (el botón no aparece).
export function conAudiodescripcionInicial(key: string, content: unknown): unknown {
  if (!isSectionKey(key) || !content || typeof content !== "object" || Array.isArray(content)) {
    return content;
  }
  const inicial = (SECTION_DEFINITIONS[key].contenidoInicial as { audiodescripcion?: string })
    .audiodescripcion;
  if (inicial === undefined || "audiodescripcion" in content) return content;
  return { ...content, audiodescripcion: inicial };
}
