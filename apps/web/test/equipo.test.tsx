import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Persona } from "../src/public/data";
import { EquipoFila } from "../src/public/EquipoFila";
import { ajusteDentroDePantalla, RETARDO_APERTURA_MS } from "../src/public/useCardsEquipo";
import { expectNoAxeViolations } from "./axe";

const persona = (name: string, extra: Partial<Persona> = {}): Persona => ({
  name,
  position: "Diseño UX",
  bio: null,
  area: null,
  education: null,
  email: null,
  links: [],
  photo: null,
  ...extra,
});

const EQUIPO = [
  persona("Ana", {
    area: "Diseño",
    education: "Universidad de Chile",
    bio: "Diseña los mensajes de voz.",
    email: "ana@signal.cl",
    links: [{ red: "LinkedIn", url: "https://linkedin.com/in/ana" }],
  }),
  persona("Luis"),
  persona("Sofía"),
  persona("Pedro"),
  persona("Vale"),
];

const boton = (nombre: string) => screen.getByRole("button", { name: new RegExp(`^${nombre}`) });
const card = (nombre: string) => {
  const b = boton(nombre);
  return document.getElementById(b.getAttribute("aria-controls")!)!;
};
const abierta = (nombre: string) => boton(nombre).getAttribute("aria-expanded") === "true";

afterEach(() => vi.useRealTimers());

describe("equipo en fila con card desplegable", () => {
  it("muestra a cada persona como un botón con su nombre y cargo, sin violaciones de axe", async () => {
    const { container } = render(<EquipoFila personas={EQUIPO} />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(boton("Ana")).toHaveAccessibleName("Ana Diseño UX");
    expect(boton("Ana")).toHaveAttribute("aria-expanded", "false");
    // Cada nombre es un encabezado del equipo.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(5);
    await expectNoAxeViolations(container);
  });

  it("la card muestra solo los datos que existen", () => {
    render(<EquipoFila personas={EQUIPO} />);
    const ana = card("Ana");
    expect(ana).toHaveTextContent("Diseño · Universidad de Chile");
    expect(ana).toHaveTextContent("Diseña los mensajes de voz.");
    expect(ana.querySelector('a[href="mailto:ana@signal.cl"]')).not.toBeNull();
    // Sin foto, la card muestra la inicial (decorativa) y solo nombre y cargo.
    expect(card("Luis").textContent).toBe("LLuisDiseño UX");
  });

  it("un clic la abre y la fija; otro clic la cierra", async () => {
    const usuario = userEvent.setup();
    render(<EquipoFila personas={EQUIPO} />);
    await usuario.click(boton("Ana"));
    expect(abierta("Ana")).toBe(true);
    await usuario.click(boton("Ana"));
    expect(abierta("Ana")).toBe(false);
  });

  it("con el teclado se abre sin animación, se recorre con Tab y Escape devuelve el foco", async () => {
    const usuario = userEvent.setup();
    render(<EquipoFila personas={EQUIPO} />);
    await usuario.tab();
    expect(boton("Ana")).toHaveFocus();
    await usuario.keyboard("{Enter}");
    expect(abierta("Ana")).toBe(true);
    expect(card("Ana")).toHaveAttribute("data-instantanea");

    await usuario.tab();
    expect(screen.getByRole("link", { name: "ana@signal.cl" })).toHaveFocus();
    await usuario.keyboard("{Escape}");
    expect(abierta("Ana")).toBe(false);
    expect(boton("Ana")).toHaveFocus();
  });

  it("se cierra cuando el foco sale de esa persona", async () => {
    const usuario = userEvent.setup();
    render(<EquipoFila personas={EQUIPO} />);
    await usuario.click(boton("Luis"));
    await usuario.tab();
    expect(boton("Sofía")).toHaveFocus();
    expect(abierta("Luis")).toBe(false);
  });

  it("con el mouse se abre al apuntar tras un instante y se cierra al salir", () => {
    vi.useFakeTimers();
    render(<EquipoFila personas={EQUIPO} />);
    const li = boton("Sofía").closest("li")!;
    fireEvent.pointerEnter(li, { pointerType: "mouse" });
    expect(abierta("Sofía")).toBe(false);
    act(() => vi.advanceTimersByTime(RETARDO_APERTURA_MS));
    expect(abierta("Sofía")).toBe(true);
    expect(card("Sofía")).not.toHaveAttribute("data-instantanea");

    // Pasar directo a otra persona la abre al instante y sin animación.
    fireEvent.pointerLeave(li, { pointerType: "mouse" });
    fireEvent.pointerEnter(boton("Pedro").closest("li")!, { pointerType: "mouse" });
    expect(abierta("Pedro")).toBe(true);
    expect(abierta("Sofía")).toBe(false);
    expect(card("Pedro")).toHaveAttribute("data-instantanea");

    fireEvent.pointerLeave(boton("Pedro").closest("li")!, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(200));
    expect(abierta("Pedro")).toBe(false);
  });

  it("Escape descarta la card abierta con el mouse (WCAG 1.4.13)", () => {
    vi.useFakeTimers();
    render(<EquipoFila personas={EQUIPO} />);
    fireEvent.pointerEnter(boton("Vale").closest("li")!, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(RETARDO_APERTURA_MS));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(abierta("Vale")).toBe(false);
  });

  it("en pantallas táctiles apuntar no abre: el toque es un clic", () => {
    vi.useFakeTimers();
    render(<EquipoFila personas={EQUIPO} />);
    fireEvent.pointerEnter(boton("Ana").closest("li")!, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(500));
    expect(abierta("Ana")).toBe(false);
  });

  it("un clic fuera cierra la card fijada", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <EquipoFila personas={EQUIPO} />
        <p>Fuera</p>
      </>,
    );
    await usuario.click(boton("Ana"));
    await usuario.click(screen.getByText("Fuera"));
    expect(abierta("Ana")).toBe(false);
  });
});

describe("ajusteDentroDePantalla", () => {
  it("corre la card hacia adentro si se sale por un borde", () => {
    expect(ajusteDentroDePantalla({ left: -40, right: 280 }, 360)).toBe(56);
    expect(ajusteDentroDePantalla({ left: 100, right: 400 }, 360)).toBe(-56);
    expect(ajusteDentroDePantalla({ left: 20, right: 340 }, 360)).toBe(0);
  });
});

describe("equipo en el inicio", () => {
  it("«Nosotros» del inicio muestra la fila del equipo con sus cards", async () => {
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const { MemoryRouter } = await import("react-router");
    const { RENDERIZADORES } = await import("../src/public/sections");
    const cliente = new QueryClient();
    cliente.setQueryData(["equipo"], { items: EQUIPO });
    const Vista = RENDERIZADORES["nosotros-inicio"] as unknown as (p: {
      contenido: object;
      nivel: 2;
      idTitulo: string;
    }) => React.ReactElement;
    const { container } = render(
      <QueryClientProvider client={cliente}>
        <MemoryRouter>
          <Vista
            contenido={{ titulo: "Quiénes hacen SIGNAL", texto: "Somos un equipo." }}
            nivel={2}
            idTitulo="t"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Quiénes hacen SIGNAL" })).toBeVisible();
    expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(5);
    await userEvent.setup().click(boton("Ana"));
    expect(abierta("Ana")).toBe(true);
    await expectNoAxeViolations(container);
  });
});

describe("equipo en «Nosotros»: tarjetas grandes en una fila", () => {
  it("muestra a todas las personas con su información a la vista", async () => {
    const { EquipoTarjetas } = await import("../src/public/EquipoTarjetas");
    const { container } = render(<EquipoTarjetas personas={EQUIPO} />);
    const tarjetas = screen
      .getAllByRole("listitem")
      .filter((li) => li.classList.contains("persona"));
    expect(tarjetas).toHaveLength(5);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(
      EQUIPO.map((p) => p.name),
    );
    // Sin botones ni cards ocultas: la información está siempre visible.
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Diseño · Universidad de Chile")).toBeVisible();
    expect(screen.getByRole("link", { name: "ana@signal.cl" })).toHaveAttribute(
      "href",
      "mailto:ana@signal.cl",
    );
    await expectNoAxeViolations(container);
  });
});
