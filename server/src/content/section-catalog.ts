import type { Db } from "../lib/prisma.js";
import { asJson } from "../lib/json.js";
import { SECTION_DEFINITIONS, sectionSchemas, type SectionKey } from "./sections.js";

// Crea las secciones del catálogo que aún no existen en la base, sin tocar las que
// ya están. Lo usan el seed y el servidor al arrancar: así una sección nueva del
// catálogo aparece en el panel de una base existente sin volver a correr el seed.
//
// El orden: en una base vacía se usa el del catálogo; en una que ya tiene secciones
// en esa página, la nueva va al final de ella. Así no repite un número de orden con
// una sección existente (quedaría ambigua en el panel) y la administración la mueve
// donde quiera.
export async function createMissingSections(db: Db): Promise<SectionKey[]> {
  const filas = await db.section.findMany({ select: { key: true, page: true, order: true } });
  const existentes = new Set(filas.map((s) => s.key));
  // Último orden de las páginas que ya tenían secciones al empezar (no cambia el
  // criterio de una página mientras se van creando sus secciones nuevas).
  const ultimoOrden = new Map<string, number>();
  for (const f of filas) {
    ultimoOrden.set(f.page, Math.max(ultimoOrden.get(f.page) ?? 0, f.order));
  }
  const creadas: SectionKey[] = [];
  const ordenNuevo = (page: string, delCatalogo: number) => {
    const ultimo = ultimoOrden.get(page);
    if (ultimo === undefined) return delCatalogo;
    ultimoOrden.set(page, ultimo + 1);
    return ultimo + 1;
  };
  for (const key of Object.keys(SECTION_DEFINITIONS) as SectionKey[]) {
    if (existentes.has(key)) continue;
    const def = SECTION_DEFINITIONS[key];
    // Si el contenido inicial no cumple su propio esquema es un error de código: mejor fallar aquí.
    const content = sectionSchemas[key].parse(def.contenidoInicial);
    // upsert sin cambios: si otro proceso (el seed y el servidor a la vez) la creó
    // recién, no falla ni la pisa.
    await db.section.upsert({
      where: { key },
      update: {},
      create: {
        key,
        page: def.page,
        order: ordenNuevo(def.page, def.order),
        visible: def.visibleInicial ?? true,
        content: asJson(content),
        publishedAt: new Date(),
      },
    });
    creadas.push(key);
  }
  return creadas;
}
