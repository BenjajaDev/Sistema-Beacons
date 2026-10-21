import { useEffect, useRef } from "react";

// Resumen de errores al enviar un formulario. Recibe el foco (y role="alert" lo
// anuncia) y cada error enlaza a su campo, para corregirlo sin buscarlo.

export interface ErrorDeCampo {
  // id del control (input, select o textarea) al que se refiere el error.
  campoId: string;
  mensaje: string;
}

export function ErrorSummary({
  errores,
  titulo = "Revisa estos campos antes de continuar:",
}: {
  errores: ErrorDeCampo[];
  titulo?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errores.length) ref.current?.focus();
  }, [errores]);

  if (!errores.length) return null;
  return (
    <div className="resumen-errores" role="alert" tabIndex={-1} ref={ref}>
      <h2>{titulo}</h2>
      <ul>
        {errores.map((e) => (
          <li key={e.campoId}>
            <a
              href={`#${e.campoId}`}
              onClick={(ev) => {
                ev.preventDefault();
                document.getElementById(e.campoId)?.focus();
              }}
            >
              {e.mensaje}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
