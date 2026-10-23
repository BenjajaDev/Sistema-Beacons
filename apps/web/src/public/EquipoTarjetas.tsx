import { useId, useRef } from "react";
import { Redes, VozDeImagen } from "./components";
import type { Persona } from "./data";
import { FotoPersona } from "./FotoPersona";
import { useCarrusel } from "./useCarrusel";

// El equipo en «Nosotros»: tarjetas grandes con toda la información a la vista,
// en un carrusel. Se recorre con las flechas (con forma de beacon), deslizando
// con el dedo o, con el foco en el carrusel, con las flechas del teclado.

export function EquipoTarjetas({ personas }: { personas: Persona[] }) {
  const id = useId();
  const pista = useRef<HTMLDivElement>(null);
  const { desborda, alInicio, alFinal, desplazar } = useCarrusel(pista);
  return (
    <div className="carrusel">
      <div
        ref={pista}
        id={id}
        className="carrusel__pista"
        {...(desborda && {
          tabIndex: 0,
          role: "region",
          "aria-roledescription": "carrusel",
          "aria-label": "Integrantes del equipo",
        })}
      >
        <ul className="personas">
          {personas.map((p, i) => (
            <li key={`${p.name}-${i}`} className="persona">
              <TarjetaPersona persona={p} />
            </li>
          ))}
        </ul>
      </div>
      {desborda && (
        <div className="carrusel__controles">
          <FlechaBeacon
            sentido="anterior"
            controla={id}
            inactiva={alInicio}
            onClick={() => desplazar(-1)}
          />
          <FlechaBeacon
            sentido="siguiente"
            controla={id}
            inactiva={alFinal}
            onClick={() => desplazar(1)}
          />
        </div>
      )}
    </div>
  );
}

// Contenido de una tarjeta. Exportado para la vista previa del panel.
export function TarjetaPersona({ persona: p }: { persona: Persona }) {
  const detalle = [p.area, p.education].filter(Boolean).join(" · ");
  return (
    <>
      <div className="persona__marco">
        <FotoPersona persona={p} className="persona__foto" claseInicial="persona__inicial" />
        {p.photo && <VozDeImagen imagen={p.photo} />}
      </div>
      <h3 className="persona__nombre">{p.name}</h3>
      <p className="persona__cargo">{p.position}</p>
      {detalle && <p className="persona__detalle">{detalle}</p>}
      {p.bio && <p className="persona__bio">{p.bio}</p>}
      {p.email && (
        <p className="persona__correo">
          <a href={`mailto:${p.email}`}>{p.email}</a>
        </p>
      )}
      <Redes redes={p.links} etiqueta={`Enlaces de ${p.name}`} variante="iconos" />
    </>
  );
}

// Flecha del carrusel: un beacon que emite su señal hacia donde avanza.
// aria-disabled (y no disabled) para que siga en el orden de tabulación.
function FlechaBeacon({
  sentido,
  controla,
  inactiva,
  onClick,
}: {
  sentido: "anterior" | "siguiente";
  controla: string;
  inactiva: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`carrusel__flecha carrusel__flecha--${sentido}`}
      aria-controls={controla}
      aria-label={sentido === "anterior" ? "Ver integrantes anteriores" : "Ver más integrantes"}
      aria-disabled={inactiva || undefined}
      onClick={() => !inactiva && onClick()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path className="carrusel__beacon" d="M3.5 8.2 8.6 6.6 11.4 12l-2.8 5.4-5.1-1.6Z" />
        <circle className="carrusel__luz" cx="7.3" cy="12" r="1.4" />
        <path className="carrusel__onda" d="M14.2 8.6a4.6 4.6 0 0 1 0 6.8" />
        <path className="carrusel__onda carrusel__onda--2" d="M17.3 5.8a8.6 8.6 0 0 1 0 12.4" />
      </svg>
    </button>
  );
}
