import { useEffect, useRef } from "react";
import { guiaGuardada, usePreferencia } from "@shared/theme/preferences";

// Guía de lectura: oscurece la página salvo una franja que acompaña a quien lee.
// La franja sigue al puntero (también con el dedo) y, con teclado, al elemento que
// tiene el foco. Es decorativa (aria-hidden) y no intercepta clics ni toques.
// No se mueve sola ni anima: solo se desplaza cuando la persona se mueve.
export function GuiaLectura() {
  const activa = usePreferencia<boolean>(guiaGuardada);
  const capa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activa) return;
    const elemento = capa.current;
    if (!elemento) return;

    let cuadro = 0;
    let y = window.innerHeight * 0.4;
    const pintar = () => {
      cuadro = 0;
      elemento.style.setProperty("--guia-y", `${y}px`);
    };
    const mover = (nuevaY: number) => {
      y = nuevaY;
      if (!cuadro) cuadro = requestAnimationFrame(pintar);
    };

    const alMoverPuntero = (e: PointerEvent) => mover(e.clientY);
    // Tras enfocar, el navegador desplaza el elemento a la vista: se mide después.
    const alEnfocar = (e: FocusEvent) => {
      const destino = e.target;
      if (!(destino instanceof HTMLElement)) return;
      requestAnimationFrame(() => {
        const caja = destino.getBoundingClientRect();
        mover(caja.top + Math.min(caja.height, 96) / 2);
      });
    };

    pintar();
    document.addEventListener("pointermove", alMoverPuntero, { passive: true });
    document.addEventListener("focusin", alEnfocar);
    return () => {
      document.removeEventListener("pointermove", alMoverPuntero);
      document.removeEventListener("focusin", alEnfocar);
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, [activa]);

  if (!activa) return null;
  return <div ref={capa} className="guia-lectura" aria-hidden="true" />;
}
