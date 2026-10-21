import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

// Qué card del equipo está abierta y cómo se abrió. Cumple WCAG 1.4.13 (contenido
// al pasar el cursor): la card se puede recorrer con el puntero, no se cierra
// sola y Escape la descarta.
//
//  - Con el mouse: se abre al apuntar (tras un instante, para que barrer la fila
//    no abra cards sin querer) y se cierra al salir de la persona y su card.
//  - Con clic, toque o teclado: queda fijada hasta otro clic, Escape, un clic
//    fuera o que el foco salga de esa persona.

export interface CardAbierta {
  indice: number;
  // Abierta con clic, toque o teclado: no se cierra al retirar el puntero.
  fijada: boolean;
  // Sin animación: se abrió con el teclado o se pasó directo desde otra card.
  instantanea: boolean;
}

// Retardo de la primera apertura con el mouse, y gracia al salir (el puntero
// cruza el espacio entre la persona y su card).
export const RETARDO_APERTURA_MS = 120;
export const GRACIA_CIERRE_MS = 150;

export function useCardsEquipo(contenedor: RefObject<HTMLElement | null>) {
  const [abierta, setAbierta] = useState<CardAbierta | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // El valor actual, para los manejadores que corren fuera del render.
  const actual = useRef(abierta);
  useLayoutEffect(() => {
    actual.current = abierta;
  });

  const cancelar = () => clearTimeout(temporizador.current);
  useEffect(() => cancelar, []);

  const cerrar = useCallback(() => {
    cancelar();
    setAbierta(null);
  }, []);

  const alApuntar = useCallback((indice: number) => {
    cancelar();
    const a = actual.current;
    if (a?.indice === indice) return;
    if (a?.fijada) return;
    // Si ya hay una abierta, el cambio es inmediato y sin animación.
    if (a) {
      setAbierta({ indice, fijada: false, instantanea: true });
      return;
    }
    temporizador.current = setTimeout(
      () => setAbierta({ indice, fijada: false, instantanea: false }),
      RETARDO_APERTURA_MS,
    );
  }, []);

  const alRetirar = useCallback((indice: number) => {
    cancelar();
    const a = actual.current;
    if (!a || a.fijada || a.indice !== indice) return;
    temporizador.current = setTimeout(() => setAbierta(null), GRACIA_CIERRE_MS);
  }, []);

  const alActivar = useCallback((indice: number, conTeclado: boolean) => {
    cancelar();
    const a = actual.current;
    if (a?.indice === indice && a.fijada) {
      setAbierta(null);
      return;
    }
    setAbierta({
      indice,
      fijada: true,
      instantanea: conTeclado || (a !== null && a.indice !== indice),
    });
  }, []);

  // Escape la descarta, y un clic o toque fuera cierra la fijada.
  useEffect(() => {
    if (!abierta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    const fuera = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) cerrar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fuera);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fuera);
    };
  }, [abierta, cerrar, contenedor]);

  return { abierta, alApuntar, alRetirar, alActivar, cerrar };
}

// Desplazamiento horizontal (en px) para que la card no se salga de la pantalla
// por los bordes. `rect` es la posición de la card centrada bajo la persona.
export function ajusteDentroDePantalla(
  rect: { left: number; right: number },
  anchoVentana: number,
  margen = 16,
) {
  if (rect.left < margen) return margen - rect.left;
  if (rect.right > anchoVentana - margen) return anchoVentana - margen - rect.right;
  return 0;
}
