// Tipos de recurso del repositorio abierto. La clave se guarda en la base (enum
// ResourceKind) y la etiqueta es lo que lee la persona. Se repiten en
// apps/web/src/public/data.ts; un test verifica que coincidan.
export const TIPOS_RECURSO = [
  { clave: "REPORT", etiqueta: "Informe" },
  { clave: "ARTICLE", etiqueta: "Artículo científico" },
  { clave: "GUIDE", etiqueta: "Guía y manual" },
  { clave: "PRESS_KIT", etiqueta: "Kit de prensa" },
  { clave: "OTHER", etiqueta: "Otro" },
] as const;

export type ClaveTipoRecurso = (typeof TIPOS_RECURSO)[number]["clave"];

export const CLAVES_TIPO_RECURSO = TIPOS_RECURSO.map((t) => t.clave) as [
  ClaveTipoRecurso,
  ...ClaveTipoRecurso[],
];
