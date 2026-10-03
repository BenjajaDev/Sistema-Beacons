// Genera apps/web/src/shared/styles/theme-default.css desde la paleta y las
// fuentes por defecto. Es el respaldo del frontend si el servidor no inyecta el tema.
//
//   npm run gen:theme -w server

import { writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_FONTS, DEFAULT_PALETTE, fontsToCss, paletteToCss } from "../src/content/theme.js";

export const THEME_DEFAULT_CSS_PATH = path.resolve(
  import.meta.dirname,
  "../../apps/web/src/shared/styles/theme-default.css",
);

export function themeDefaultCss(): string {
  return (
    "/* Generado por `npm run gen:theme -w server` desde server/src/content/theme.ts.\n" +
    "   No editar a mano: el servidor inyecta los valores de Identidad visual sobre estos. */\n" +
    paletteToCss(DEFAULT_PALETTE) +
    "\n" +
    fontsToCss(DEFAULT_FONTS) +
    "\n"
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  writeFileSync(THEME_DEFAULT_CSS_PATH, themeDefaultCss());
  console.log(`Escrito ${THEME_DEFAULT_CSS_PATH}`);
}
