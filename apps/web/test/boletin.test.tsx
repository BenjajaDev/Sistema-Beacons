import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import BajaBoletin from "../src/public/Boletin";
import { Layout } from "../src/public/Layout";
import Inicio from "../src/public/pages/Inicio";
import { expectNoAxeViolations } from "./axe";

const sitio = {
  siteName: "SIGNAL",
  tagline: "Navegación interior accesible",
  logos: { claro: null, oscuro: null },
  favicon: null,
  contacto: { telefono: null, correo: "hola@signal.cl", direccion: null, redes: [] },
  accesibilidad: "Este sitio busca cumplir WCAG 2.1 AA.",
};

const inicio = {
  secciones: [
    { key: "hero", content: { titulo: "Orientarse con voz", bajada: "Bajada" } },
    {
      key: "boletin",
      content: {
        titulo: "Recibe las novedades",
        intro: "Te contaremos cuando haya noticias.",
        textoConsentimiento: "Acepto recibir el boletín de SIGNAL por correo.",
        avisoPrivacidad: "Usaremos tu correo solo para el boletín.",
        textoBoton: "Suscribirme",
        mensajeExito: "¡Quedaste suscrita o suscrito!",
      },
    },
  ],
};

function montar(ruta: string) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  cliente.setQueryData(["site"], sitio);
  cliente.setQueryData(["pagina", "inicio"], inicio);
  const router = createMemoryRouter(
    [
      {
        Component: Layout,
        children: [
          { index: true, Component: Inicio },
          { path: "boletin/baja", Component: BajaBoletin },
        ],
      },
    ],
    { initialEntries: [ruta] },
  );
  return render(
    <QueryClientProvider client={cliente}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("formulario del boletín", () => {
  it("nace sin la casilla marcada, con su aviso de privacidad, y pasa axe", async () => {
    const { container } = montar("/");
    expect(
      screen.getByRole("heading", { level: 2, name: "Recibe las novedades" }),
    ).toBeInTheDocument();
    const casilla = screen.getByRole("checkbox", { name: /Acepto recibir el boletín/ });
    expect(casilla).not.toBeChecked();
    expect(casilla).toHaveAccessibleDescription("Usaremos tu correo solo para el boletín.");
    expect(screen.getByLabelText("Nombre (opcional)")).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("sin correo ni consentimiento no envía, marca los campos y enfoca el primero", async () => {
    const usuario = userEvent.setup();
    const espia = vi.spyOn(globalThis, "fetch");
    const { container } = montar("/");
    await usuario.click(screen.getByRole("button", { name: "Suscribirme" }));
    expect(espia).not.toHaveBeenCalled();
    const correo = screen.getByLabelText("Correo electrónico");
    expect(correo).toHaveAttribute("aria-invalid", "true");
    expect(correo).toHaveAccessibleDescription("Escribe tu correo.");
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-invalid", "true");
    expect(await screen.findByLabelText("Correo electrónico")).toHaveFocus();
    await expectNoAxeViolations(container);

    // Con el correo pero sin aceptar, el foco va a la casilla.
    await usuario.type(correo, "ana@correo.cl");
    await usuario.click(screen.getByRole("button", { name: "Suscribirme" }));
    expect(espia).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(
      /Marca la casilla para aceptar recibir el boletín\./,
    );
  });

  it("envía con consentimiento y confirma con el texto del panel", async () => {
    const usuario = userEvent.setup();
    const espia = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, mensaje: "¡Quedaste suscrita o suscrito!" }), {
        status: 201,
      }),
    );
    montar("/");
    await usuario.type(screen.getByLabelText("Correo electrónico"), " ana@correo.cl ");
    await usuario.type(screen.getByLabelText("Nombre (opcional)"), "Ana");
    await usuario.click(screen.getByRole("checkbox"));
    await usuario.click(screen.getByRole("button", { name: "Suscribirme" }));

    const confirmacion = await screen.findByText("¡Quedaste suscrita o suscrito!");
    expect(confirmacion.closest("[tabindex='-1']")).toHaveFocus();
    const cuerpo = JSON.parse(String(espia.mock.calls[0]![1]!.body));
    expect(cuerpo).toEqual({ correo: "ana@correo.cl", nombre: "Ana", consentimiento: true });
  });

  it("muestra el error del servidor junto al campo", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Revisa los campos marcados.",
          code: "VALIDATION",
          campos: { correo: "Escribe un correo válido, por ejemplo nombre@dominio.cl." },
        }),
        { status: 400 },
      ),
    );
    montar("/");
    await usuario.type(screen.getByLabelText("Correo electrónico"), "a@b.c");
    await usuario.click(screen.getByRole("checkbox"));
    await usuario.click(screen.getByRole("button", { name: "Suscribirme" }));
    expect(await screen.findByLabelText("Correo electrónico")).toHaveAccessibleDescription(
      /correo válido/,
    );
  });
});

describe("baja del boletín", () => {
  it("pide confirmar y solo da de baja al pulsar el botón", async () => {
    const usuario = userEvent.setup();
    const espia = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { container } = montar("/boletin/baja?t=secreto-de-prueba-123");
    expect(screen.getByRole("heading", { level: 1, name: "Baja del boletín" })).toBeInTheDocument();
    // Abrir el enlace no hace nada por sí solo.
    expect(espia).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);

    await usuario.click(screen.getByRole("button", { name: "Darme de baja" }));
    expect(await screen.findByText(/no recibirás más correos/)).toBeInTheDocument();
    expect(String(espia.mock.calls[0]![0])).toBe("/api/public/newsletter/unsubscribe");
    expect(JSON.parse(String(espia.mock.calls[0]![1]!.body))).toEqual({
      token: "secreto-de-prueba-123",
    });
    expect(screen.queryByRole("button", { name: "Darme de baja" })).toBeNull();
  });

  it("sin enlace o con uno inválido explica cómo pedir la baja por correo", async () => {
    const { unmount } = montar("/boletin/baja");
    expect(screen.getByText(/enlace de baja no es válido/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByRole("link", { name: "hola@signal.cl" }),
    ).toHaveAttribute("href", "mailto:hola@signal.cl");
    unmount();

    const usuario = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "No existe.", code: "NOT_FOUND" }), { status: 404 }),
    );
    montar("/boletin/baja?t=vencido-vencido-vencido");
    await usuario.click(screen.getByRole("button", { name: "Darme de baja" }));
    expect(await screen.findByText(/enlace de baja no es válido/)).toBeInTheDocument();
  });

  it("si falla la red permite reintentar", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    montar("/boletin/baja?t=secreto-de-prueba-123");
    await usuario.click(screen.getByRole("button", { name: "Darme de baja" }));
    expect(await screen.findByText(/No pudimos darte de baja/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Darme de baja" })).toBeInTheDocument();
  });
});
