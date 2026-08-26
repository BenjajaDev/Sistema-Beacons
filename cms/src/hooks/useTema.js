import { useCallback, useEffect, useState } from "react";

const CLAVE = "signal-cms-tema";

// Tema inicial: lo guardado por el usuario y, si no hay nada, el del sistema.
function temaInicial() {
  const guardado = localStorage.getItem(CLAVE);
  if (guardado === "claro" || guardado === "oscuro") return guardado;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

// Devuelve [tema, alternar]. El tema se aplica en <html data-tema="…">,
// que es donde styles.css tiene definidos los tokens del modo oscuro.
export default function useTema() {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
  }, [tema]);

  // Si el usuario no ha elegido tema, seguimos los cambios del sistema.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = (e) => {
      if (!localStorage.getItem(CLAVE)) setTema(e.matches ? "oscuro" : "claro");
    };
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

  // Al alternar sí guardamos la preferencia: a partir de ahí manda el usuario.
  const alternar = useCallback(() => {
    setTema((t) => {
      const nuevo = t === "oscuro" ? "claro" : "oscuro";
      localStorage.setItem(CLAVE, nuevo);
      return nuevo;
    });
  }, []);

  return [tema, alternar];
}