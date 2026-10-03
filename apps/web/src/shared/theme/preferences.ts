// Preferencias de la persona (tema y tamaño de texto), guardadas en este
// navegador. theme-init.js lee las mismas claves antes del primer pintado.

export type TemaPreferido = "claro" | "oscuro" | "sistema";

export const CLAVE_TEMA = "signal-tema";
export const CLAVE_TEXTO = "signal-texto";

// Escalas del control A−/A+ sobre el tamaño de letra del navegador (que también respeta).
export const ESCALAS = [0.875, 1, 1.125, 1.25, 1.5] as const;
export type Escala = (typeof ESCALAS)[number];

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento: la preferencia dura hasta recargar.
  }
}

export function temaGuardado(): TemaPreferido {
  const t = leer(CLAVE_TEMA);
  return t === "claro" || t === "oscuro" ? t : "sistema";
}

export function escalaGuardada(): Escala {
  const e = Number(leer(CLAVE_TEXTO));
  return (ESCALAS as readonly number[]).includes(e) ? (e as Escala) : 1;
}

export function aplicarTema(tema: TemaPreferido) {
  const raiz = document.documentElement;
  // Transición suave de colores solo durante el cambio (no en la carga).
  raiz.classList.add("tema-en-transicion");
  if (tema === "claro") raiz.setAttribute("data-theme", "light");
  else if (tema === "oscuro") raiz.setAttribute("data-theme", "dark");
  else raiz.removeAttribute("data-theme");
  window.setTimeout(() => raiz.classList.remove("tema-en-transicion"), 350);
  guardar(CLAVE_TEMA, tema);
}

export function aplicarEscala(escala: Escala) {
  document.documentElement.style.fontSize = escala === 1 ? "" : `${escala * 100}%`;
  guardar(CLAVE_TEXTO, String(escala));
}
