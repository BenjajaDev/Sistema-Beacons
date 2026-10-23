import { useEffect, useId, useSyncExternalStore } from "react";
import { IconoDetener, IconoVoz } from "../ui/Icons";
import { detener, hablar, leyendo, suscribir, vozDisponible } from "./voz";

// Botón que lee un texto en voz alta y, mientras suena, lo detiene. Si el
// navegador no tiene voz o no hay texto, no se muestra.
export function BotonVoz({
  texto,
  etiqueta,
  etiquetaDetener = "Detener la lectura",
  variante = "icono",
  className = "",
}: {
  texto: string;
  // Nombre accesible del botón (y texto visible en la variante con texto).
  etiqueta: string;
  etiquetaDetener?: string;
  variante?: "icono" | "texto";
  className?: string;
}) {
  const id = useId();
  const sonando = useSyncExternalStore(suscribir, leyendo, () => null) === id;

  // Si el botón desaparece (cambio de página) mientras lee, se calla.
  useEffect(
    () => () => {
      if (leyendo() === id) detener();
    },
    [id],
  );

  if (!vozDisponible() || !texto.trim()) return null;
  const nombre = sonando ? etiquetaDetener : etiqueta;
  const Icono = sonando ? IconoDetener : IconoVoz;
  const alternar = () => (sonando ? detener() : hablar(id, texto));

  if (variante === "texto") {
    return (
      <button
        type="button"
        className={`btn btn--secundario boton-voz ${className}`.trim()}
        onClick={alternar}
      >
        <Icono width="1.25em" height="1.25em" />
        <span>{nombre}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`icon-btn boton-voz boton-voz--icono ${className}`.trim()}
      aria-label={nombre}
      title={nombre}
      onClick={alternar}
    >
      <Icono />
    </button>
  );
}
