import { useId } from "react";
import { Button } from "@shared/ui/Button";
import { ContenidoCard } from "../public/EquipoFila";
import { TarjetaPersona } from "../public/EquipoTarjetas";
import type { Encuadre, Persona } from "../public/data";
import { ENCUADRE_INICIAL, FotoPersona } from "../public/FotoPersona";
import "../public/landing.css";

// Vista previa en vivo de una persona del equipo, con los mismos componentes y
// estilos de la landing: el círculo y la card del inicio, y la tarjeta de
// Nosotros. Debajo, el encuadre de la foto: punto de enfoque y zoom. No recorta
// el archivo (para eso está «Encuadrar imagen»); solo elige qué parte se ve.

const CONTROLES: {
  clave: keyof Encuadre;
  etiqueta: string;
  min: number;
  max: number;
  paso: number;
}[] = [
  { clave: "x", etiqueta: "Enfoque horizontal", min: 0, max: 100, paso: 1 },
  { clave: "y", etiqueta: "Enfoque vertical", min: 0, max: 100, paso: 1 },
  { clave: "zoom", etiqueta: "Zoom", min: 1, max: 3, paso: 0.05 },
];

const textoValor = (clave: keyof Encuadre, valor: number) =>
  clave === "zoom"
    ? `${Math.round(valor * 100)} %`
    : clave === "x"
      ? `${Math.round(valor)} % desde la izquierda`
      : `${Math.round(valor)} % desde arriba`;

export function VistaPreviaPersona({
  persona,
  onEncuadre,
}: {
  persona: Persona;
  onEncuadre: (encuadre: Encuadre | null) => void;
}) {
  const id = useId();
  const encuadre = persona.photoFrame ?? ENCUADRE_INICIAL;
  return (
    <section className="vista-persona" aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`} className="vista-persona__titulo">
        Vista previa
      </h3>
      {/* Solo para mirar: inerte, sin foco ni lector, como las demás vistas previas. */}
      <div className="vista-persona__marcos" inert>
        <figure className="vista-persona__marco">
          <div className="integrante integrante--estatico">
            <span className="integrante__marco">
              <FotoPersona
                persona={persona}
                className="integrante__foto"
                claseInicial="integrante__inicial"
                decorativa
              />
            </span>
            <span className="integrante__nombre">{persona.name || "Nombre"}</span>
            <span className="integrante__cargo">{persona.position || "Cargo"}</span>
          </div>
          <figcaption>Inicio: círculo</figcaption>
        </figure>
        <figure className="vista-persona__marco">
          <div className="integrante__card integrante__card--estatica">
            <ContenidoCard persona={persona} />
          </div>
          <figcaption>Inicio: card al apuntar</figcaption>
        </figure>
        <figure className="vista-persona__marco">
          <div className="persona">
            <TarjetaPersona persona={persona} />
          </div>
          <figcaption>Nosotros: tarjeta</figcaption>
        </figure>
      </div>

      {persona.photo ? (
        <fieldset className="grupo-campos vista-persona__encuadre">
          <legend>Ajustar la foto en los marcos</legend>
          <p className="campo__ayuda">
            Elige qué parte de la foto se ve y cuánto se acerca. El archivo no cambia.
          </p>
          {CONTROLES.map((c) => (
            <div key={c.clave} className="campo recorte__control">
              <label htmlFor={`${id}-${c.clave}`} className="campo__label">
                {c.etiqueta}
              </label>
              <input
                id={`${id}-${c.clave}`}
                type="range"
                min={c.min}
                max={c.max}
                step={c.paso}
                value={encuadre[c.clave]}
                aria-valuetext={textoValor(c.clave, encuadre[c.clave])}
                onChange={(e) => onEncuadre({ ...encuadre, [c.clave]: Number(e.target.value) })}
              />
            </div>
          ))}
          <Button
            variante="fantasma"
            aria-disabled={persona.photoFrame === null || undefined}
            onClick={() => persona.photoFrame !== null && onEncuadre(null)}
          >
            Centrar y quitar el zoom
          </Button>
        </fieldset>
      ) : (
        <p className="campo__ayuda">Sube una foto para ajustar cómo se ve en cada marco.</p>
      )}
    </section>
  );
}
