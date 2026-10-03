import { useEffect, useRef } from "react";

// Al cambiar de vista en una SPA el navegador no mueve el foco ni anuncia nada.
// Este hook, usado en cada página, pone el título del documento y, si la página
// no es la primera que se carga, lleva el foco a su <h1> (que debe tener
// tabIndex={-1}). Así el lector de pantalla anuncia la nueva página y Tab sigue
// desde ahí (WCAG 2.4.3).

let primeraCarga = true;

export function usePage(titulo: string, sitio = "SIGNAL") {
  const h1Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = titulo === sitio ? sitio : `${titulo} · ${sitio}`;
  }, [titulo, sitio]);

  useEffect(() => {
    if (primeraCarga) {
      primeraCarga = false;
      return;
    }
    h1Ref.current?.focus();
  }, []);

  return h1Ref;
}

// Solo para tests: simula una navegación posterior a la primera carga.
export function __reiniciarPrimeraCarga(valor = true) {
  primeraCarga = valor;
}
