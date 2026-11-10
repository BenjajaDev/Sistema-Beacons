// Preferencias de la persona (tema, tamaño de texto, zoom, fuente y guía de lectura),
// guardadas en este navegador. theme-init.js lee las mismas claves antes del primer
// pintado, así que no hay destello al cargar.
import { useSyncExternalStore } from "react";

export type TemaPreferido = "claro" | "oscuro" | "sistema" | "contraste";
export type FuentePreferida = "normal" | "dislexia";

export const CLAVE_TEMA = "signal-tema";
export const CLAVE_TEXTO = "signal-texto";
export const CLAVE_ZOOM = "signal-zoom";
export const CLAVE_FUENTE = "signal-fuente";
export const CLAVE_GUIA = "signal-guia";

// Escalas del control A−/A+ del panel sobre el tamaño de letra del navegador (que también respeta).
export const ESCALAS = [0.875, 1, 1.125, 1.25, 1.5] as const;
export type Escala = (typeof ESCALAS)[number];

// Pasos del control Zoom−/Zoom+ del sitio público (el panel usa A−/A+): agranda
// toda la página (texto, imágenes y espacios), como el zoom del navegador.
// theme-init.js valida la misma lista.
export const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;
export type Zoom = (typeof ZOOMS)[number];

// Si el navegador no deja usar localStorage (modo privado estricto), la preferencia
// dura hasta recargar pero los controles siguen mostrando lo que está aplicado.
const memoria = new Map<string, string>();
const AVISO = "signal-preferencias";

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return memoria.get(clave) ?? null;
  }
}

function guardar(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    if (valor === null) memoria.delete(clave);
    else memoria.set(clave, valor);
  }
  // Avisa a los controles que muestran esta preferencia (por ejemplo, tras restablecer).
  window.dispatchEvent(new Event(AVISO));
}

function suscribir(aviso: () => void) {
  window.addEventListener(AVISO, aviso);
  return () => window.removeEventListener(AVISO, aviso);
}

// Lee una preferencia como valor primitivo y se vuelve a renderizar cuando cambia.
export function usePreferencia<T extends string | number | boolean>(leerValor: () => T): T {
  return useSyncExternalStore(suscribir, leerValor, leerValor);
}

export function temaGuardado(): TemaPreferido {
  const t = leer(CLAVE_TEMA);
  return t === "claro" || t === "oscuro" || t === "contraste" ? t : "sistema";
}

export function escalaGuardada(): Escala {
  const e = Number(leer(CLAVE_TEXTO));
  return (ESCALAS as readonly number[]).includes(e) ? (e as Escala) : 1;
}

export function zoomGuardado(): Zoom {
  const z = Number(leer(CLAVE_ZOOM));
  return (ZOOMS as readonly number[]).includes(z) ? (z as Zoom) : 1;
}

export function fuenteGuardada(): FuentePreferida {
  return leer(CLAVE_FUENTE) === "dislexia" ? "dislexia" : "normal";
}

export function guiaGuardada(): boolean {
  return leer(CLAVE_GUIA) === "1";
}

export function aplicarTema(tema: TemaPreferido) {
  const raiz = document.documentElement;
  // Transición suave de colores solo durante el cambio (no en la carga).
  raiz.classList.add("tema-en-transicion");
  // El alto contraste es el tema oscuro más un atributo propio: así toda regla del
  // tema oscuro (logos, pie) sigue valiendo y solo cambian los colores.
  if (tema === "claro") raiz.setAttribute("data-theme", "light");
  else if (tema === "oscuro" || tema === "contraste") raiz.setAttribute("data-theme", "dark");
  else raiz.removeAttribute("data-theme");
  if (tema === "contraste") raiz.setAttribute("data-contraste", "");
  else raiz.removeAttribute("data-contraste");
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

// Fuente pensada para dislexia (OpenDyslexic): el CSS cambia las dos familias del sitio.
export function aplicarFuente(fuente: FuentePreferida) {
  const raiz = document.documentElement;
  if (fuente === "dislexia") raiz.setAttribute("data-fuente", "dislexia");
  else raiz.removeAttribute("data-fuente");
  guardar(CLAVE_FUENTE, fuente);
}

// La guía de lectura la dibuja un componente (GuiaLectura) que escucha este valor.
export function aplicarGuia(activa: boolean) {
  guardar(CLAVE_GUIA, activa ? "1" : null);
}

// Vuelve todo a lo que elige el navegador y el sistema.
export function restablecerPreferencias() {
  aplicarTema("sistema");
  aplicarZoom(1);
  aplicarFuente("normal");
  aplicarGuia(false);
}
