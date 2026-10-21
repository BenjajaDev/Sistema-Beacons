import { useEffect, useState, type RefObject } from "react";

// Si el contenido de un elemento es más ancho que el elemento (hay scroll
// horizontal). Una región con scroll debe poder enfocarse para desplazarla con el
// teclado (axe: scrollable-region-focusable); si no lo hay, no se agrega una
// parada de tabulación inútil.
export function useDesborde(ref: RefObject<HTMLElement | null>) {
  const [desborda, setDesborda] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => setDesborda(el.scrollWidth > el.clientWidth + 1);
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    medir();
    return () => observador.disconnect();
  }, [ref]);
  return desborda;
}
