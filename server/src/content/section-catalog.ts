import type { Db } from "../lib/prisma.js";
import { asJson } from "../lib/json.js";
import { SECTION_DEFINITIONS, sectionSchemas, type SectionKey } from "./sections.js";

// Crea las secciones del catálogo que aún no existen en la base, sin tocar las que
// ya están. Lo usan el seed y el servidor al arrancar: así una sección nueva del
// catálogo aparece en el panel de una base existente sin volver a correr el seed.
export async function createMissingSections(db: Db): Promise<SectionKey[]> {
  const existentes = new Set(
    (await db.section.findMany({ select: { key: true } })).map((s) => s.key),
  );
  const creadas: SectionKey[] = [];
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
        order: def.order,
        visible: def.visibleInicial ?? true,
        content: asJson(content),
        publishedAt: new Date(),
      },
    });
    creadas.push(key);
  }
  return creadas;
}
