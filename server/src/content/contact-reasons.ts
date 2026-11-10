// Motivos de consulta del formulario de contacto. La clave se guarda en la base
// (enum ContactReason) y la etiqueta es lo que lee la persona. Se repiten en
// apps/web/src/public/data.ts; un test verifica que coincidan.
export const MOTIVOS_CONTACTO = [
  { clave: "SPACE", etiqueta: "Quiero SIGNAL en mi espacio" },
  { clave: "COLLABORATION", etiqueta: "Colaboración o alianza" },
  { clave: "PRESS", etiqueta: "Prensa" },
  { clave: "RESEARCH", etiqueta: "Investigación" },
  { clave: "SUPPORT", etiqueta: "Ayuda con la app" },
  { clave: "OTHER", etiqueta: "Otro motivo" },
] as const;

export const CLAVES_MOTIVO = MOTIVOS_CONTACTO.map((m) => m.clave) as [
  (typeof MOTIVOS_CONTACTO)[number]["clave"],
  ...(typeof MOTIVOS_CONTACTO)[number]["clave"][],
];
