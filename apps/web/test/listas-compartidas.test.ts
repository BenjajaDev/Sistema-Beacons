import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIAS_NOTICIA, MOTIVOS_CONTACTO, TIPOS_RECURSO } from "../src/public/data";

// Estas listas viven en el servidor (que valida) y se repiten en la web (que las
// muestra). Se leen como texto para no acoplar el typecheck de la web al servidor.
const leer = (archivo: string) =>
  readFileSync(resolve(process.cwd(), "../../server/src/content", archivo), "utf8");

describe("listas compartidas con el servidor", () => {
  it("las categorías de noticias coinciden", () => {
    const bloque = /CATEGORIAS_NOTICIA = \[([^\]]+)\] as const/.exec(leer("news-categories.ts"));
    const servidor = [...(bloque?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(servidor.length).toBe(5);
    expect([...CATEGORIAS_NOTICIA]).toEqual(servidor);
  });

  it("los motivos de contacto coinciden, con la misma clave y etiqueta", () => {
    const fuente = leer("contact-reasons.ts");
    const servidor = [...fuente.matchAll(/clave: "([A-Z_]+)", etiqueta: "([^"]+)"/g)].map((m) => ({
      clave: m[1],
      etiqueta: m[2],
    }));
    expect(servidor.length).toBe(6);
    expect([...MOTIVOS_CONTACTO]).toEqual(servidor);
  });

  it("los tipos de recurso coinciden, con la misma clave y etiqueta", () => {
    const fuente = leer("resource-kinds.ts");
    const servidor = [...fuente.matchAll(/clave: "([A-Z_]+)", etiqueta: "([^"]+)"/g)].map((m) => ({
      clave: m[1],
      etiqueta: m[2],
    }));
    expect(servidor.length).toBe(5);
    expect([...TIPOS_RECURSO]).toEqual(servidor);
  });
});
