import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

// Diálogo modal sobre <dialog> nativo: atrapa el foco, cierra con Escape, marca
// el resto de la página como inerte y devuelve el foco a quien lo abrió.

interface DialogProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: ReactNode;
  children?: ReactNode;
  acciones?: ReactNode;
  // Para alertas de confirmación, que exigen respuesta.
  rol?: "dialog" | "alertdialog";
}

export function Dialog({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  acciones,
  rol = "dialog",
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const anterior = useRef<HTMLElement | null>(null);
  const id = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) {
      anterior.current = document.activeElement as HTMLElement | null;
      dialogo.showModal();
      // Foco inicial explícito: el elemento marcado con data-autofocus o, si no hay,
      // el que elija el navegador (el primero enfocable).
      dialogo.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!abierto && dialogo.open) {
      dialogo.close();
    }
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className="dialogo"
      role={rol === "alertdialog" ? "alertdialog" : undefined}
      aria-labelledby={`${id}-titulo`}
      aria-describedby={descripcion ? `${id}-desc` : undefined}
      onClose={() => {
        onCerrar();
        anterior.current?.focus();
      }}
    >
      <h2 id={`${id}-titulo`}>{titulo}</h2>
      {descripcion && <div id={`${id}-desc`}>{descripcion}</div>}
      {children}
      {acciones && <div className="dialogo__acciones">{acciones}</div>}
    </dialog>
  );
}

interface ConfirmDialogProps {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  mensaje: ReactNode;
  // Texto específico de la acción, por ejemplo «Borrar beacon 1-16», no solo «Aceptar».
  textoConfirmar: string;
  textoCancelar?: string;
  peligro?: boolean;
  onConfirmar: () => Promise<void> | void;
}

// Confirmación de acciones destructivas. El foco inicial va a «Cancelar»: un
// Enter por inercia no borra nada.
export function ConfirmDialog({
  abierto,
  onCerrar,
  titulo,
  mensaje,
  textoConfirmar,
  textoCancelar = "Cancelar",
  peligro = true,
  onConfirmar,
}: ConfirmDialogProps) {
  const [procesando, setProcesando] = useState(false);

  async function confirmar() {
    setProcesando(true);
    try {
      await onConfirmar();
      onCerrar();
    } finally {
      setProcesando(false);
    }
  }

  return (
    <Dialog
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion={mensaje}
      rol="alertdialog"
      acciones={
        <>
          <Button variante="secundario" onClick={onCerrar} data-autofocus>
            {textoCancelar}
          </Button>
          <Button
            variante={peligro ? "peligro" : "primario"}
            cargando={procesando}
            onClick={confirmar}
          >
            {textoConfirmar}
          </Button>
        </>
      }
    />
  );
}
