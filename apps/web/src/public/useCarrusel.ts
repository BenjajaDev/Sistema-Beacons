import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from "react";

// Estado de un carrusel horizontal con scroll nativo: si hay más contenido que
// ancho (desborda) y si está en el inicio o al final, para habilitar las flechas.
// Una región con scroll debe poder enfocarse para desplazarla con el teclado
// (axe: scrollable-region-focusable); si no desborda, no se agrega esa parada.
export function useCarrusel(ref: RefObject<HTMLElement | null>) {
  const [estado, setEstado] = useState({ desborda: false, alInicio: true, alFinal: true });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEstado({
        desborda: max > 1,
        alInicio: el.scrollLeft <= 1,
        alFinal: el.scrollLeft >= max - 1,
      });
    };
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    el.addEventListener("scroll", medir, { passive: true });
    medir();
    return () => {
      observador.disconnect();
      el.removeEventListener("scroll", medir);
    };
  }, [ref]);

  // Avanza o retrocede una tarjeta. Sin animación si la persona pidió reducir movimiento.
  const desplazar = useCallback(
    (sentido: 1 | -1) => {
      const el = ref.current;
      const tarjeta = el?.querySelector("li");
      if (!el || !tarjeta) return;
      const espacio = parseFloat(getComputedStyle(tarjeta.parentElement!).columnGap) || 0;
      // offsetWidth (y no la caja en pantalla): mide en las mismas unidades que el
      // scroll, también con el zoom de la página.
      el.scrollBy({
        left: sentido * (tarjeta.offsetWidth + espacio),
        behavior: reducirMovimiento() ? "auto" : "smooth",
      });
    },
    [ref],
  );

  const irAlInicio = useCallback(() => {
    ref.current?.scrollTo({ left: 0, behavior: reducirMovimiento() ? "auto" : "smooth" });
  }, [ref]);

  return { ...estado, desplazar, irAlInicio };
}

const CONSULTA_REDUCIR = "(prefers-reduced-motion: reduce)";
const reducirMovimiento = () =>
  typeof window.matchMedia === "function" && window.matchMedia(CONSULTA_REDUCIR).matches;

export const INTERVALO_AUTOAVANCE_MS = 10_000;

// Avance automático cada 10 s (WCAG 2.2.2: lo que se mueve solo más de 5 s debe
// poder pausarse). Se detiene mientras la persona apunta o tiene el foco dentro
// del carrusel, con la pestaña oculta y con «reducir movimiento»; `pausado` es
// el botón Pausar/Reanudar.
export function useAutoavance(
  ref: RefObject<HTMLElement | null>,
  { pausado, avanzar }: { pausado: boolean; avanzar: () => void },
) {
  const [retenido, setRetenido] = useState(false);
  const reducir = useSyncExternalStore(
    (aviso) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(CONSULTA_REDUCIR);
      mq.addEventListener("change", aviso);
      return () => mq.removeEventListener("change", aviso);
    },
    reducirMovimiento,
    () => true,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const entra = (e: PointerEvent) => e.pointerType === "mouse" && setRetenido(true);
    const sale = (e: PointerEvent) => e.pointerType === "mouse" && setRetenido(false);
    const foco = () => setRetenido(true);
    const sinFoco = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) setRetenido(false);
    };
    el.addEventListener("pointerenter", entra);
    el.addEventListener("pointerleave", sale);
    el.addEventListener("focusin", foco);
    el.addEventListener("focusout", sinFoco);
    return () => {
      el.removeEventListener("pointerenter", entra);
      el.removeEventListener("pointerleave", sale);
      el.removeEventListener("focusin", foco);
      el.removeEventListener("focusout", sinFoco);
    };
  }, [ref]);

  const activo = !pausado && !retenido && !reducir;
  useEffect(() => {
    if (!activo) return;
    const intervalo = window.setInterval(() => {
      if (!document.hidden) avanzar();
    }, INTERVALO_AUTOAVANCE_MS);
    return () => window.clearInterval(intervalo);
  }, [activo, avanzar]);

  // Con «reducir movimiento» no avanza solo: no se ofrece pausar lo que no se mueve.
  return { disponible: !reducir };
}
