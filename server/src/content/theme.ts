import { z } from "zod";

// Tokens de color que la landing y el panel convierten en variables CSS.
// Identidad visual edita estos valores; las reglas de contraste de abajo impiden
// guardar una paleta que incumpla WCAG 2.1 AA.

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Usa un color hexadecimal de 6 dígitos, por ejemplo #1A56DB.");

export const paletteModeSchema = z.object({
  fondo: hex,
  superficie: hex,
  texto: hex,
  textoSuave: hex,
  primario: hex,
  textoSobrePrimario: hex,
  enlace: hex,
  // Bordes decorativos (separadores, tarjetas). Sin requisito de contraste.
  borde: hex,
  // Bordes de inputs y controles: deben distinguirse del fondo (WCAG 1.4.11).
  bordeControl: hex,
  foco: hex,
  // Color de marca para decoración e ilustraciones; no se usa para texto.
  acento: hex,
});

export const paletteSchema = z.object({ light: paletteModeSchema, dark: paletteModeSchema });

export type PaletteMode = z.infer<typeof paletteModeSchema>;
export type Palette = z.infer<typeof paletteSchema>;
type ColorToken = keyof PaletteMode;

export const DEFAULT_PALETTE: Palette = {
  light: {
    fondo: "#FFFFFF",
    superficie: "#EEF3FF",
    texto: "#0D1B3E",
    textoSuave: "#3B4A6B",
    primario: "#1A56DB",
    textoSobrePrimario: "#FFFFFF",
    enlace: "#1A56DB",
    borde: "#C0D0F5",
    bordeControl: "#5A6B8C",
    foco: "#1A56DB",
    acento: "#5B8EFF",
  },
  dark: {
    fondo: "#0A1530",
    superficie: "#152044",
    texto: "#EEF3FF",
    textoSuave: "#B8C7EA",
    // #1A56DB no llega a 4,5:1 sobre #0A1530, así que en oscuro el primario es el azul claro.
    primario: "#5B8EFF",
    textoSobrePrimario: "#0A1530",
    enlace: "#5B8EFF",
    borde: "#2A3B6E",
    bordeControl: "#7F93C6",
    foco: "#8FB1FF",
    acento: "#1A56DB",
  },
};

// --- Tipografías -----------------------------------------------------------
// Solo se permiten fuentes autoalojadas en el build (sin CDN externos).

export const FONT_OPTIONS = {
  "atkinson-hyperlegible-next": {
    nombre: "Atkinson Hyperlegible Next",
    stack: '"Atkinson Hyperlegible Next", system-ui, sans-serif',
  },
  "bricolage-grotesque": {
    nombre: "Bricolage Grotesque",
    stack: '"Bricolage Grotesque", system-ui, sans-serif',
  },
  sistema: {
    nombre: "Fuente del sistema",
    stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
} as const;

export type FontId = keyof typeof FONT_OPTIONS;
const fontId = z.enum(Object.keys(FONT_OPTIONS) as [FontId, ...FontId[]]);

export const fontsSchema = z.object({ cuerpo: fontId, titulos: fontId });
export type Fonts = z.infer<typeof fontsSchema>;

export const DEFAULT_FONTS: Fonts = {
  cuerpo: "atkinson-hyperlegible-next",
  titulos: "bricolage-grotesque",
};

// --- Contraste (WCAG 2.1) ---------------------------------------------------

function luminancia(color: string): number {
  const canales = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canales.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

interface ContrastRule {
  frente: ColorToken;
  fondo: ColorToken;
  minimo: number;
  uso: string;
}

export const CONTRAST_RULES: ContrastRule[] = [
  { frente: "texto", fondo: "fondo", minimo: 4.5, uso: "texto sobre el fondo" },
  { frente: "texto", fondo: "superficie", minimo: 4.5, uso: "texto sobre tarjetas" },
  { frente: "textoSuave", fondo: "fondo", minimo: 4.5, uso: "texto secundario sobre el fondo" },
  {
    frente: "textoSuave",
    fondo: "superficie",
    minimo: 4.5,
    uso: "texto secundario sobre tarjetas",
  },
  { frente: "enlace", fondo: "fondo", minimo: 4.5, uso: "enlaces sobre el fondo" },
  { frente: "enlace", fondo: "superficie", minimo: 4.5, uso: "enlaces sobre tarjetas" },
  {
    frente: "textoSobrePrimario",
    fondo: "primario",
    minimo: 4.5,
    uso: "texto de los botones principales",
  },
  { frente: "primario", fondo: "fondo", minimo: 3, uso: "botones principales sobre el fondo" },
  { frente: "bordeControl", fondo: "fondo", minimo: 3, uso: "borde de campos de formulario" },
  { frente: "bordeControl", fondo: "superficie", minimo: 3, uso: "borde de campos sobre tarjetas" },
  { frente: "foco", fondo: "fondo", minimo: 3, uso: "indicador de foco" },
  { frente: "foco", fondo: "superficie", minimo: 3, uso: "indicador de foco sobre tarjetas" },
];

export interface ContrastFailure extends ContrastRule {
  modo: "light" | "dark";
  ratio: number;
}

export function checkPaletteContrast(palette: Palette): ContrastFailure[] {
  const fallas: ContrastFailure[] = [];
  for (const modo of ["light", "dark"] as const) {
    for (const regla of CONTRAST_RULES) {
      const ratio = contrastRatio(palette[modo][regla.frente], palette[modo][regla.fondo]);
      if (ratio < regla.minimo) fallas.push({ ...regla, modo, ratio });
    }
  }
  return fallas;
}
