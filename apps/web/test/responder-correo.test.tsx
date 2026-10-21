import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@shared/ui/Toast";
import { enlacesDeRespuesta, ResponderCorreo } from "../src/admin/ResponderCorreo";
import { expectNoAxeViolations } from "./axe";

const CORREO = "ana+signal@ejemplo.cl";

function montar() {
  return render(
    <ToastProvider>
      <ResponderCorreo correo={CORREO} nombre="Ana" asunto="Re: Visita & recorrido" />
      <button type="button">Otro botón</button>
    </ToastProvider>,
  );
}

describe("responder un mensaje", () => {
  it("arma los enlaces de Gmail, Outlook y la app con la dirección y el asunto escapados", () => {
    const e = enlacesDeRespuesta(CORREO, "Re: Visita & recorrido");
    expect(e.gmail).toBe(
      "https://mail.google.com/mail/?view=cm&fs=1&to=ana%2Bsignal%40ejemplo.cl&su=Re%3A%20Visita%20%26%20recorrido",
    );
    expect(e.outlook).toBe(
      "https://outlook.office.com/mail/deeplink/compose?to=ana%2Bsignal%40ejemplo.cl&subject=Re%3A%20Visita%20%26%20recorrido",
    );
    expect(e.app).toBe("mailto:ana%2Bsignal%40ejemplo.cl?subject=Re%3A%20Visita%20%26%20recorrido");
  });

  it("es un botón de divulgación: abre las opciones y Escape lo cierra y devuelve el foco", async () => {
    const usuario = userEvent.setup();
    const { container } = montar();
    const boton = screen.getByRole("button", { name: "Responder a Ana" });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /Gmail/ })).toBeNull();

    await usuario.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    const gmail = screen.getByRole("link", { name: "En Gmail (se abre en una pestaña nueva)" });
    expect(gmail).toHaveAttribute("target", "_blank");
    expect(gmail).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "En la app de correo" })).toHaveAttribute(
      "href",
      enlacesDeRespuesta(CORREO, "Re: Visita & recorrido").app,
    );
    await expectNoAxeViolations(container);

    await usuario.tab();
    expect(gmail).toHaveFocus();
    await usuario.keyboard("{Escape}");
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(boton).toHaveFocus();
  });

  it("se cierra al tocar fuera", async () => {
    const usuario = userEvent.setup();
    montar();
    const boton = screen.getByRole("button", { name: "Responder a Ana" });
    await usuario.click(boton);
    await usuario.click(screen.getByRole("button", { name: "Otro botón" }));
    expect(boton).toHaveAttribute("aria-expanded", "false");
  });

  it("copia la dirección y lo avisa; si no puede, la muestra en el aviso", async () => {
    const usuario = userEvent.setup();
    const escribir = vi.spyOn(navigator.clipboard, "writeText");
    montar();
    const boton = screen.getByRole("button", { name: "Responder a Ana" });

    await usuario.click(boton);
    await usuario.click(screen.getByRole("button", { name: "Copiar la dirección" }));
    expect(escribir).toHaveBeenCalledWith(CORREO);
    expect(await screen.findByText(`Copiamos ${CORREO}.`)).toBeInTheDocument();
    expect(boton).toHaveFocus();

    escribir.mockRejectedValueOnce(new Error("sin permiso"));
    await usuario.click(boton);
    await usuario.click(screen.getByRole("button", { name: "Copiar la dirección" }));
    expect(
      await screen.findByText(`No se pudo copiar. La dirección es ${CORREO}.`),
    ).toBeInTheDocument();
  });
});
