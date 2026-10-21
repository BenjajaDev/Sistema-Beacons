import { useRef } from "react";
import { Img, Redes } from "./components";
import type { Persona } from "./data";
import { useDesborde } from "./useDesborde";

// El equipo en «Nosotros»: una tarjeta grande por persona, con toda su
// información a la vista, en una sola fila. Si no caben (pantallas angostas o
// texto agrandado), la fila se desplaza de lado y se puede recorrer con el teclado.

export function EquipoTarjetas({ personas }: { personas: Persona[] }) {
  const region = useRef<HTMLDivElement>(null);
  const desborda = useDesborde(region);
  return (
    <div
      ref={region}
      className="personas-fila"
      {...(desborda && {
        tabIndex: 0,
        role: "region",
        "aria-label": "Integrantes del equipo (se desplaza hacia el lado)",
      })}
    >
      <ul className="personas">
        {personas.map((m, i) => {
          const detalle = [m.area, m.education].filter(Boolean).join(" · ");
          return (
            <li key={`${m.name}-${i}`} className="persona">
              <div className="persona__marco">
                {m.photo ? (
                  <Img imagen={m.photo} className="persona__foto" />
                ) : (
                  <span className="persona__inicial" aria-hidden="true">
                    {m.name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <h3 className="persona__nombre">{m.name}</h3>
              <p className="persona__cargo">{m.position}</p>
              {detalle && <p className="persona__detalle">{detalle}</p>}
              {m.bio && <p className="persona__bio">{m.bio}</p>}
              {m.email && (
                <p className="persona__correo">
                  <a href={`mailto:${m.email}`}>{m.email}</a>
                </p>
              )}
              <Redes redes={m.links} etiqueta={`Enlaces de ${m.name}`} variante="iconos" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
