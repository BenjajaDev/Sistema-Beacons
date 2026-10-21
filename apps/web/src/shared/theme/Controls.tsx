import { useState } from "react";
import { IconoLuna, IconoPantalla, IconoSol } from "../ui/Icons";
import {
  aplicarEscala,
  aplicarTema,
  escalaGuardada,
  ESCALAS,
  temaGuardado,
  type TemaPreferido,
} from "./preferences";

const OPCIONES: { valor: TemaPreferido; texto: string; Icono: typeof IconoSol }[] = [
  { valor: "claro", texto: "Claro", Icono: IconoSol },
  { valor: "oscuro", texto: "Oscuro", Icono: IconoLuna },
  { valor: "sistema", texto: "Según el sistema", Icono: IconoPantalla },
];

// Selector de tema como grupo de radios: se recorre con las flechas y el lector
// anuncia «Tema de colores, Oscuro, seleccionado, 2 de 3».
export function ThemeSwitcher() {
  const [tema, setTema] = useState<TemaPreferido>(temaGuardado);

  return (
    <fieldset className="segmentado">
      <legend>Tema de colores</legend>
      {OPCIONES.map(({ valor, texto, Icono }) => (
        <label key={valor} title={texto}>
          <input
            type="radio"
            name="tema"
            value={valor}
            checked={tema === valor}
            onChange={() => {
              setTema(valor);
              aplicarTema(valor);
            }}
          />
          <Icono width="1.25em" height="1.25em" />
          <span className="visually-hidden">{texto}</span>
        </label>
      ))}
    </fieldset>
  );
}

// A− / A+ sobre el tamaño de letra del navegador. El cambio se anuncia en una
// región de estado y los botones quedan enfocables en los extremos.
export function TextSizeControl() {
  const [indice, setIndice] = useState(() => ESCALAS.indexOf(escalaGuardada()));

  function cambiar(delta: number) {
    const nuevo = Math.min(ESCALAS.length - 1, Math.max(0, indice + delta));
    if (nuevo === indice) return;
    setIndice(nuevo);
    aplicarEscala(ESCALAS[nuevo]!);
  }

  const porcentaje = Math.round(ESCALAS[indice]! * 100);
  const enMinimo = indice === 0;
  const enMaximo = indice === ESCALAS.length - 1;

  return (
    <div className="tamano-texto" role="group" aria-label="Tamaño del texto">
      <button
        type="button"
        className="btn btn--secundario"
        aria-label="A−: reducir el tamaño del texto"
        aria-disabled={enMinimo || undefined}
        onClick={() => cambiar(-1)}
      >
        A−
      </button>
      <button
        type="button"
        className="btn btn--secundario"
        aria-label="A+: aumentar el tamaño del texto"
        aria-disabled={enMaximo || undefined}
        onClick={() => cambiar(1)}
      >
        A+
      </button>
      <span className="visually-hidden" role="status">
        {`Texto al ${porcentaje} %`}
      </span>
    </div>
  );
}
