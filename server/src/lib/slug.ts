// Convierte un título en un slug para la URL: "¿Qué es SIGNAL?" → "que-es-signal".
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Devuelve `base`, o `base-2`, `base-3`... si ya está en uso.
export async function uniqueSlug(
  base: string,
  existe: (slug: string) => Promise<boolean>,
): Promise<string> {
  const raiz = base || "nota";
  if (!(await existe(raiz))) return raiz;
  for (let i = 2; i < 1000; i++) {
    const candidato = `${raiz.slice(0, 75)}-${i}`;
    if (!(await existe(candidato))) return candidato;
  }
  throw new Error("No se encontró un slug libre.");
}
