import { z } from "zod";

// Configuración del audiodescriptor: la voz con que el sitio lee las
// audiodescripciones y los textos alternativos (Web Speech API del navegador).
// Las voces dependen de cada dispositivo: la elegida se usa si existe y, si no,
// la mejor disponible para el idioma.

export const IDIOMAS_VOZ = [
  { valor: "es-CL", texto: "Español (Chile)" },
  { valor: "es-ES", texto: "Español (España)" },
  { valor: "es-MX", texto: "Español (México)" },
  { valor: "es-AR", texto: "Español (Argentina)" },
  { valor: "es-US", texto: "Español (Estados Unidos)" },
  { valor: "en-US", texto: "Inglés (Estados Unidos)" },
  { valor: "en-GB", texto: "Inglés (Reino Unido)" },
  { valor: "pt-BR", texto: "Portugués (Brasil)" },
] as const;

export const VELOCIDAD_MIN = 0.5;
export const VELOCIDAD_MAX = 2;

const idiomas = IDIOMAS_VOZ.map((i) => i.valor) as [
  (typeof IDIOMAS_VOZ)[number]["valor"],
  ...(typeof IDIOMAS_VOZ)[number]["valor"][],
];

export const voiceSchema = z.object({
  idioma: z.enum(idiomas, "Elige un idioma de la lista."),
  // Nombre de la voz del sistema (como lo entrega speechSynthesis). Vacía: automática.
  voz: z.string().trim().max(200),
  velocidad: z
    .number("Indica la velocidad.")
    .min(VELOCIDAD_MIN, `La velocidad mínima es ${VELOCIDAD_MIN}.`)
    .max(VELOCIDAD_MAX, `La velocidad máxima es ${VELOCIDAD_MAX}.`),
});

export type Voice = z.infer<typeof voiceSchema>;

export const DEFAULT_VOICE: Voice = { idioma: "es-CL", voz: "", velocidad: 1 };

// Lo guardado en la base; {} (bases anteriores) o algo inválido da los valores por defecto.
export function parseVoice(valor: unknown): Voice {
  const r = voiceSchema.safeParse(valor);
  return r.success ? r.data : DEFAULT_VOICE;
}
