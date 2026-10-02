import { DEFAULT_FONTS, DEFAULT_PALETTE } from "./theme.js";

// Valores con que el seed crea la configuración del sitio la primera vez.
export const DEFAULT_SITE_SETTINGS = {
  id: 1,
  siteName: "SIGNAL",
  tagline: "Navegación interior accesible",
  palette: DEFAULT_PALETTE,
  fonts: DEFAULT_FONTS,
  socials: [],
  accessibilityStatement:
    "Este sitio busca cumplir las Pautas de Accesibilidad para el Contenido Web (WCAG) 2.1 en su nivel AA. " +
    "Si encuentras una barrera de accesibilidad, escríbenos desde la página de contacto y la corregiremos.",
};
