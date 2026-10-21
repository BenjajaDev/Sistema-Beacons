import { useCallback, useEffect, useState, type RefObject } from "react";

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
      const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollBy({
        left: sentido * (tarjeta.getBoundingClientRect().width + espacio),
        behavior: reducir ? "auto" : "smooth",
      });
    },
    [ref],
  );

  return { ...estado, desplazar };
}
