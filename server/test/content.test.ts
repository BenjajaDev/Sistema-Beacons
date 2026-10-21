import { describe, expect, it } from "vitest";
import {
  checkPaletteContrast,
  contrastRatio,
  DEFAULT_FONTS,
  DEFAULT_PALETTE,
  fontsSchema,
  paletteSchema,
} from "../src/content/theme.js";
import { SECTION_DEFINITIONS, sectionSchemas, type SectionKey } from "../src/content/sections.js";
import { parseLegacyBeacons } from "../src/beacons/legacy-format.js";

describe("contraste", () => {
  it("calcula la razón de contraste WCAG", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#1A56DB", "#FFFFFF")).toBeCloseTo(6.18, 1);
  });

  it("la paleta por defecto cumple WCAG 2.1 AA en claro y oscuro", () => {
    expect(paletteSchema.parse(DEFAULT_PALETTE)).toEqual(DEFAULT_PALETTE);
    expect(checkPaletteContrast(DEFAULT_PALETTE)).toEqual([]);
  });

  it("detecta una paleta que no cumple (azul claro como texto en tema claro)", () => {
    const mala = { ...DEFAULT_PALETTE, light: { ...DEFAULT_PALETTE.light, texto: "#5B8EFF" } };
    const fallas = checkPaletteContrast(mala);
    expect(fallas.map((f) => `${f.modo}:${f.frente}/${f.fondo}`)).toContain("light:texto/fondo");
  });

  it("las tipografías por defecto están en la lista permitida", () => {
    expect(fontsSchema.parse(DEFAULT_FONTS)).toEqual(DEFAULT_FONTS);
  });
});

describe("secciones", () => {
  const claves = Object.keys(SECTION_DEFINITIONS) as SectionKey[];

  it("cada sección tiene esquema y su contenido inicial lo cumple", () => {
    expect(new Set(claves)).toEqual(new Set(Object.keys(sectionSchemas)));
    for (const key of claves) {
      const r = sectionSchemas[key].safeParse(SECTION_DEFINITIONS[key].contenidoInicial);
      expect(r.success, `${key}: ${r.error?.message}`).toBe(true);
    }
  });

  it("no hay dos secciones con el mismo orden en una página", () => {
    const vistos = claves.map(
      (k) => `${SECTION_DEFINITIONS[k].page}:${SECTION_DEFINITIONS[k].order}`,
    );
    expect(new Set(vistos).size).toBe(vistos.length);
  });

  it("una imagen exige texto alternativo, salvo que sea decorativa", () => {
    const mediaId = "0e4f3c1a-5b7d-4a2e-9c8f-1d2b3a4c5e6f";
    const conImagen = (imagen: object) =>
      sectionSchemas.hero.safeParse({ ...SECTION_DEFINITIONS.hero.contenidoInicial, imagen });
    const sinAlt = conImagen({ mediaId, alt: "  " });
    expect(sinAlt.success).toBe(false);
    expect(sinAlt.error?.issues[0]?.path).toEqual(["imagen", "alt"]);
    expect(conImagen({ mediaId, alt: "", decorativa: true }).success).toBe(true);
    expect(conImagen({ mediaId, alt: "Persona usando la app" }).success).toBe(true);
    expect(conImagen({ mediaId: "no-es-uuid", alt: "x" }).success).toBe(false);
  });

  it("los pasos van de 1 a 6 y los botones de la portada son opcionales", () => {
    const paso = { titulo: "Paso", texto: "Texto" };
    const queEs = (n: number) =>
      sectionSchemas["que-es"].safeParse({ titulo: "Qué es", pasos: Array(n).fill(paso) });
    expect([0, 1, 6, 7].map((n) => queEs(n).success)).toEqual([false, true, true, false]);
    const heroSinBotones: Record<string, unknown> = {
      ...SECTION_DEFINITIONS.hero.contenidoInicial,
    };
    delete heroSinBotones.accionPrincipal;
    delete heroSinBotones.accionSecundaria;
    expect(sectionSchemas.hero.safeParse(heroSinBotones).success).toBe(true);
  });

  it("las secciones agregadas después nacen ocultas", () => {
    expect(SECTION_DEFINITIONS["imagen-texto-inicio"].visibleInicial).toBe(false);
    expect(SECTION_DEFINITIONS["imagen-texto-nosotros"].visibleInicial).toBe(false);
  });

  it("rechaza enlaces javascript: en los botones", () => {
    const hero = {
      ...SECTION_DEFINITIONS.hero.contenidoInicial,
      accionPrincipal: { texto: "x", href: "javascript:alert(1)" },
    };
    expect(sectionSchemas.hero.safeParse(hero).success).toBe(false);
  });
});

describe("parseLegacyBeacons", () => {
  it("informa cada entrada inválida sin detener la importación", () => {
    const { beacons, errores } = parseLegacyBeacons({
      "1-1": { titulo: " A ", descripcion: "B", ubicacion: "" },
      "x-1": { titulo: "A", descripcion: "B" },
      "1-2-3": { titulo: "A", descripcion: "B" },
      "1-3": { titulo: "", descripcion: "B" },
    });
    expect(beacons).toEqual([
      { major: 1, minor: 1, titulo: "A", descripcion: "B", ubicacion: null },
    ]);
    expect(errores).toHaveLength(3);
  });
});

describe("CSS del tema", () => {
  it("el CSS por defecto del frontend está sincronizado con la paleta del servidor", async () => {
    const { readFileSync } = await import("node:fs");
    const { THEME_DEFAULT_CSS_PATH, themeDefaultCss } = await import("../scripts/gen-theme-css.js");
    // Si falla: ejecuta `npm run gen:theme -w server` y commitea el archivo.
    expect(readFileSync(THEME_DEFAULT_CSS_PATH, "utf-8").replaceAll("\r\n", "\n")).toBe(
      themeDefaultCss(),
    );
  });

  it("themeCss usa los valores por defecto si lo guardado no es válido", async () => {
    const { themeCss, paletteToCss } = await import("../src/content/theme.js");
    expect(themeCss({ palette: { roto: true }, fonts: null })).toContain(
      paletteToCss(DEFAULT_PALETTE),
    );
  });
});
