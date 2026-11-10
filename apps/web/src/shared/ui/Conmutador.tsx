import { useId } from "react";

// Interruptor de encendido y apagado. Es un <input type="checkbox" role="switch">:
// el lector anuncia «activado» o «desactivado», funciona con Espacio y el objetivo
// táctil mide 44 px. El estado no depende del color: la perilla se desplaza y
// muestra una marca cuando está activo (WCAG 1.4.1).
export function Conmutador({
  etiqueta,
  ayuda,
  activo,
  onCambiar,
}: {
  etiqueta: string;
  ayuda?: string;
  activo: boolean;
  onCambiar: (activo: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="conmutador">
      <label className="conmutador__fila" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="conmutador__control"
          checked={activo}
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          onChange={(e) => onCambiar(e.target.checked)}
        />
        <span className="conmutador__pista" aria-hidden="true">
          <span className="conmutador__perilla" />
        </span>
        <span className="conmutador__texto">{etiqueta}</span>
      </label>
      {ayuda && (
        <p id={`${id}-ayuda`} className="conmutador__ayuda">
          {ayuda}
        </p>
      )}
    </div>
  );
}
