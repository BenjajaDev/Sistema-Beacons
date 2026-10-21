import type { CSSProperties } from "react";
import { Img } from "./components";
import type { Encuadre, Persona } from "./data";

export const ENCUADRE_INICIAL: Encuadre = { x: 50, y: 50, zoom: 1 };

// Foto de una persona en cualquiera de sus marcos (círculo y card del inicio,
// tarjeta de Nosotros). El encuadre se aplica sin recortar el archivo: el punto
// de enfoque con object-position y el zoom con una escala desde ese punto (la
// variable --zoom la usa el CSS, para que el hover siga escalando sobre ella).
// Sin foto, la inicial sobre las ondas de la señal.
export function FotoPersona({
  persona,
  className,
  claseInicial,
  decorativa = false,
}: {
  persona: Pick<Persona, "name" | "photo" | "photoFrame">;
  className: string;
  claseInicial: string;
  // Decorativa cuando el nombre de la persona ya está al lado (en un botón o la card).
  decorativa?: boolean;
}) {
  if (!persona.photo) {
    return (
      <span className={claseInicial} aria-hidden="true">
        {persona.name.trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  const { x, y, zoom } = persona.photoFrame ?? ENCUADRE_INICIAL;
  const estilo = {
    objectPosition: `${x}% ${y}%`,
    transformOrigin: `${x}% ${y}%`,
    "--zoom": zoom,
  } as CSSProperties;
  return (
    <Img
      imagen={decorativa ? { ...persona.photo, alt: "" } : persona.photo}
      className={className}
      style={estilo}
    />
  );
}
