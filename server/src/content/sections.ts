import { z } from "zod";
import type { Page } from "../generated/prisma/enums.js";
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
const item = z.object({ titulo: texto(80), texto: texto(400) });
const encabezado = { titulo: texto(120), intro: textoOpcional(400) };

export const sectionSchemas = {
  hero: z.object({
    antetitulo: textoOpcional(60),
    titulo: texto(120),
    bajada: texto(300),
    accionPrincipal: enlace,
    accionSecundaria: enlace.optional(),
  }),
  "que-es": z.object({
    ...encabezado,
    pasos: z.array(item).length(3, "Esta sección muestra exactamente 3 pasos."),
  }),
  objetivos: z.object({ ...encabezado, items: z.array(item).min(1).max(8) }),
  proyecciones: z.object({ ...encabezado, items: z.array(item).min(1).max(8) }),
  "nosotros-inicio": z.object({ titulo: texto(120), texto: texto(600), accion: enlace }),
  "noticias-recientes": z.object({ ...encabezado, textoVerTodas: texto(40) }),
  "quienes-somos": z.object({ titulo: texto(120), cuerpo: richTextSchema }),
  equipo: z.object(encabezado),
  colaboradores: z.object(encabezado),
  noticias: z.object(encabezado),
  contacto: z.object({
    ...encabezado,
    formularioTitulo: texto(80),
    mensajeExito: texto(200),
  }),
} as const;

export type SectionKey = keyof typeof sectionSchemas;
export type SectionContent<K extends SectionKey> = z.infer<(typeof sectionSchemas)[K]>;

interface SectionDefinition<K extends SectionKey> {
  page: Page;
  order: number;
  // Nombre que ve quien edita en el panel.
  nombre: string;
  contenidoInicial: SectionContent<K>;
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
    },
  },
};

export function isSectionKey(key: string): key is SectionKey {
  return Object.hasOwn(sectionSchemas, key);
}

export function parseSectionContent<K extends SectionKey>(key: K, content: unknown) {
  return sectionSchemas[key].safeParse(content);
}
