import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button, IconButton } from "@shared/ui/Button";
import { ConfirmDialog } from "@shared/ui/Dialog";
import { ErrorSummary } from "@shared/ui/ErrorSummary";
import { TextArea, TextField } from "@shared/ui/Field";
import { IconoCerrar } from "@shared/ui/Icons";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { ToastProvider, useToast } from "@shared/ui/Toast";
import { expectNoAxeViolations } from "./axe";

describe("campos de formulario", () => {
  it("asocian label, ayuda y error, y marcan el campo inválido", async () => {
    const { container } = render(
      <form>
        <TextField
          label="Correo"
          ayuda="Te responderemos aquí."
          error="Escribe un correo válido."
          type="email"
        />
        <TextArea label="Mensaje" opcional />
      </form>,
    );
    const correo = screen.getByLabelText("Correo");
    expect(correo).toHaveAttribute("aria-invalid", "true");
    expect(correo).toHaveAttribute("aria-required", "true");
    expect(correo).toHaveAccessibleDescription("Escribe un correo válido. Te responderemos aquí.");
    // El opcional se dice en texto, no solo con un asterisco o un color.
    expect(screen.getByLabelText("Mensaje (opcional)")).not.toHaveAttribute("aria-required");
    await expectNoAxeViolations(container);
  });

  it("el resumen de errores recibe el foco y lleva a cada campo", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <ErrorSummary errores={[{ campoId: "nombre", mensaje: "Escribe tu nombre." }]} />
        <input id="nombre" aria-label="Nombre" />
      </>,
    );
    const resumen = screen.getByRole("alert");
    expect(resumen).toHaveFocus();
    await usuario.click(screen.getByRole("link", { name: "Escribe tu nombre." }));
    expect(screen.getByLabelText("Nombre")).toHaveFocus();
  });
});

describe("botones", () => {
  it("un botón de ícono siempre tiene nombre accesible", async () => {
    const { container } = render(
      <IconButton label="Cerrar menú">
        <IconoCerrar />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Cerrar menú" })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("mientras carga sigue enfocable, anuncia el estado y no repite la acción", async () => {
    const usuario = userEvent.setup();
    const alClic = vi.fn();
    render(
      <Button cargando textoCargando="Guardando…" onClick={alClic}>
        Guardar
      </Button>,
    );
    const boton = screen.getByRole("button", { name: "Guardando…" });
    expect(boton).toHaveAttribute("aria-busy", "true");
    expect(boton).toHaveAttribute("aria-disabled", "true");
    expect(boton).not.toBeDisabled();
    await usuario.click(boton);
    expect(alClic).not.toHaveBeenCalled();
  });
});

describe("confirmación de acciones destructivas", () => {
  function Prueba({ onConfirmar }: { onConfirmar: () => Promise<void> }) {
    const [abierto, setAbierto] = useState(false);
    return (
      <>
        <Button onClick={() => setAbierto(true)}>Borrar</Button>
        <ConfirmDialog
          abierto={abierto}
          onCerrar={() => setAbierto(false)}
          titulo="¿Borrar el beacon 1-16?"
          mensaje="La app dejará de anunciar este punto. No se puede deshacer."
          textoConfirmar="Borrar beacon 1-16"
          onConfirmar={onConfirmar}
        />
      </>
    );
  }

  it("pide confirmación con un botón específico y el foco empieza en Cancelar", async () => {
    const usuario = userEvent.setup();
    const onConfirmar = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<Prueba onConfirmar={onConfirmar} />);
    await usuario.click(screen.getByRole("button", { name: "Borrar" }));

    const dialogo = screen.getByRole("alertdialog", { name: "¿Borrar el beacon 1-16?" });
    expect(dialogo).toHaveAccessibleDescription(
      "La app dejará de anunciar este punto. No se puede deshacer.",
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await expectNoAxeViolations(container);

    await usuario.click(screen.getByRole("button", { name: "Borrar beacon 1-16" }));
    expect(onConfirmar).toHaveBeenCalledOnce();
    await waitFor(() => expect(dialogo).not.toHaveAttribute("open"));
  });

  it("al cancelar no ejecuta la acción y devuelve el foco a quien abrió", async () => {
    const usuario = userEvent.setup();
    const onConfirmar = vi.fn();
    render(<Prueba onConfirmar={onConfirmar} />);
    const abrir = screen.getByRole("button", { name: "Borrar" });
    await usuario.click(abrir);
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(abrir).toHaveFocus();
  });
});

describe("avisos", () => {
  function Disparador() {
    const toast = useToast();
    return (
      <>
        <Button onClick={() => toast.exito("Noticia guardada.")}>Éxito</Button>
        <Button onClick={() => toast.error("No se pudo guardar. Revisa tu conexión.")}>
          Error
        </Button>
      </>
    );
  }

  it("el éxito se anuncia con cortesía y se cierra solo; el error es inmediato y persiste", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Disparador />
      </ToastProvider>,
    );
    await usuario.click(screen.getByRole("button", { name: "Éxito" }));
    await usuario.click(screen.getByRole("button", { name: "Error" }));
    expect(screen.getByRole("status")).toHaveTextContent("Noticia guardada.");
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar. Revisa tu conexión.");

    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar.");

    await usuario.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    vi.useRealTimers();
  });
});

describe("estados de carga, vacío y error", () => {
  it("la carga se anuncia y los skeletons quedan ocultos al lector", async () => {
    const { container } = render(
      <Cargando etiqueta="Cargando noticias…">
        <Skeleton alto="2rem" />
      </Cargando>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Cargando noticias…");
    expect(container.querySelector(".skeleton")).toHaveAttribute("aria-hidden", "true");
    await expectNoAxeViolations(container);
  });

  it("vacío con acción sugerida y error con reintento", async () => {
    const usuario = userEvent.setup();
    const reintentar = vi.fn();
    const { container } = render(
      <>
        <EmptyState
          titulo="Aún no hay noticias"
          texto="Crea la primera."
          accion={<Button>Nueva noticia</Button>}
        />
        <ErrorState mensaje="No hay conexión con el servidor." onReintentar={reintentar} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Nueva noticia" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reintentar).toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });
});
