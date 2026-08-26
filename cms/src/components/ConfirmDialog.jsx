import { useEffect, useRef } from "react";
import { IconoAlerta } from "./Iconos.jsx";

// Diálogo de confirmación con la identidad del panel, en vez del
// confirm() nativo del navegador. Cierra con Escape o clic en el fondo.
export default function ConfirmDialog({ titulo, children, onConfirmar, onCancelar }) {
  const botonRef = useRef(null);

  useEffect(() => {
    botonRef.current?.focus();
    function alTeclear(e) {
      if (e.key === "Escape") onCancelar();
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onCancelar]);

  return (
    <div className="modal" role="presentation" onMouseDown={onCancelar}>
      <div
        className="modal__caja"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal__icono">
          <IconoAlerta size={20} />
        </div>
        <h2 id="modal-titulo">{titulo}</h2>
        <p>{children}</p>
        <div className="modal__acciones">
          <button className="btn" onClick={onCancelar}>
            Cancelar
          </button>
          <button ref={botonRef} className="btn btn--peligro-solido" onClick={onConfirmar}>
            Borrar
          </button>
        </div>
      </div>
    </div>
  );
}
