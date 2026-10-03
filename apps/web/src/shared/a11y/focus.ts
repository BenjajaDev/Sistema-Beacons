import { useCallback, useEffect, useRef, useState } from "react";

// Al cambiar de vista en una SPA el navegador no mueve el foco ni anuncia nada.
// Este hook, usado en cada página, pone el título del documento y, si la página
// no es la primera que se carga, lleva el foco a su <h1> (que debe tener
// tabIndex={-1}). Así el lector de pantalla anuncia la nueva página y Tab sigue
// desde ahí (WCAG 2.4.3).
//
// Devuelve una ref de callback: si el <h1> se reemplaza (por ejemplo, el título
// provisional mientras cargan los datos por el definitivo), el foco pasa al nuevo,
// salvo que la persona ya lo haya llevado a otra parte. (Al llegar, el foco suele
// estar en el enlace que se pulsó: el primer <h1> lo recibe siempre.)

let primeraCarga = true;

export function usePage(titulo: string, sitio = "SIGNAL") {
  // Se decide al montar: la página de la carga inicial no roba el foco.
  const [debeEnfocar] = useState(() => !primeraCarga);
  const enfocado = useRef(false);

  useEffect(() => {
    primeraCarga = false;
  }, []);

  useEffect(() => {
    document.title = titulo === sitio ? sitio : `${titulo} · ${sitio}`;
  }, [titulo, sitio]);

  return useCallback(
    (h1: HTMLHeadingElement | null) => {
      if (!h1 || !debeEnfocar) return;
      const activo = document.activeElement;
      const sinFoco = !activo || activo === document.body || activo.tagName === "H1";
      if (!enfocado.current || sinFoco) {
        h1.focus();
        enfocado.current = true;
      }
    },
    [debeEnfocar],
  );
}

// Solo para tests: simula una navegación posterior a la primera carga.
export function __reiniciarPrimeraCarga(valor = true) {
  primeraCarga = valor;
}
