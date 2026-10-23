// Preferencias de la persona (tema, tamaño de texto y zoom), guardadas en este
// navegador. theme-init.js lee las mismas claves antes del primer pintado.

export type TemaPreferido = "claro" | "oscuro" | "sistema";

export const CLAVE_TEMA = "signal-tema";
export const CLAVE_TEXTO = "signal-texto";
export const CLAVE_ZOOM = "signal-zoom";

// Escalas del control A−/A+ del panel sobre el tamaño de letra del navegador (que también respeta).
export const ESCALAS = [0.875, 1, 1.125, 1.25, 1.5] as const;
export type Escala = (typeof ESCALAS)[number];

// Pasos del control Zoom−/Zoom+ del sitio público (el panel usa A−/A+): agranda
// toda la página (texto, imágenes y espacios), como el zoom del navegador.
// theme-init.js valida la misma lista.
export const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;
export type Zoom = (typeof ZOOMS)[number];

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

export function zoomGuardado(): Zoom {
  const z = Number(leer(CLAVE_ZOOM));
  return (ZOOMS as readonly number[]).includes(z) ? (z as Zoom) : 1;
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

// El CSS aplica la variable como zoom del <body> (ver base.css).
export function aplicarZoom(zoom: Zoom) {
  const raiz = document.documentElement;
  if (zoom === 1) raiz.style.removeProperty("--zoom-pagina");
  else raiz.style.setProperty("--zoom-pagina", String(zoom));
  guardar(CLAVE_ZOOM, String(zoom));
}
