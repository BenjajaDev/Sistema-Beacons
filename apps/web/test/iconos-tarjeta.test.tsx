import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ICONOS_DE_TARJETA } from "@shared/ui/IconosTarjeta";

// La lista vive en el servidor (ICONOS_TARJETA); se lee como texto para no acoplar
// el typecheck de la web al código del servidor.
function iconosDelServidor(): string[] {
  const fuente = readFileSync(
    resolve(process.cwd(), "../../server/src/content/sections.ts"),
    "utf8",
  );
  const bloque = /ICONOS_TARJETA = \[([^\]]+)\] as const/.exec(fuente)?.[1] ?? "";
  return [...bloque.matchAll(/"([a-z]+)"/g)].map((m) => m[1] as string);
}

describe("íconos de las tarjetas", () => {
  it("la lista del servidor y los dibujos de la web coinciden", () => {
    const servidor = iconosDelServidor();
    expect(servidor.length).toBeGreaterThan(0);
    expect(Object.keys(ICONOS_DE_TARJETA).sort()).toEqual([...servidor].sort());
  });
});
