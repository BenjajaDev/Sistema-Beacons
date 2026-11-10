import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Persona } from "../src/public/data";
import { EquipoTarjetas } from "../src/public/EquipoTarjetas";
import { INTERVALO_AUTOAVANCE_MS } from "../src/public/useCarrusel";

const persona = (name: string): Persona => ({
  name,
  position: "Desarrollo",
  bio: null,
  area: null,
  education: null,
  email: null,
  links: [],
  photo: null,
  photoFrame: null,
});
const EQUIPO = ["Ana", "Luis", "Sofía", "Pedro", "Vale"].map(persona);

// jsdom no mide ni desplaza: se simula una pista que desborda.
let scrollLeft = 0;
const scrollBy = vi.fn();
const scrollTo = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  scrollLeft = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private cb: () => void) {}
      observe() {
        this.cb();
      }
      disconnect() {}
    },
  );
  Object.defineProperties(HTMLElement.prototype, {
    scrollWidth: { configurable: true, get: () => 1500 },
    clientWidth: { configurable: true, get: () => 600 },
    scrollLeft: { configurable: true, get: () => scrollLeft },
  });
  HTMLElement.prototype.scrollBy = scrollBy as unknown as HTMLElement["scrollBy"];
  HTMLElement.prototype.scrollTo = scrollTo as unknown as HTMLElement["scrollTo"];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const avanzarTiempo = () => act(() => vi.advanceTimersByTime(INTERVALO_AUTOAVANCE_MS));

describe("carrusel de Nosotros con avance automático", () => {
  it("avanza una tarjeta cada 10 s y, al final, vuelve al inicio", () => {
    render(<EquipoTarjetas personas={EQUIPO} />);
    avanzarTiempo();
    expect(scrollBy).toHaveBeenCalledTimes(1);

    scrollLeft = 900;
    fireEvent.scroll(screen.getByRole("region", { name: "Integrantes del equipo" }));
    avanzarTiempo();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 0 }));
  });

  it("se puede pausar y reanudar con un botón (WCAG 2.2.2)", () => {
    render(<EquipoTarjetas personas={EQUIPO} />);
    fireEvent.click(screen.getByRole("button", { name: "Pausar el avance automático" }));
    avanzarTiempo();
    avanzarTiempo();
    expect(scrollBy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reanudar el avance automático" }));
    avanzarTiempo();
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it("se detiene mientras el foco está dentro del carrusel", () => {
    render(<EquipoTarjetas personas={EQUIPO} />);
    const region = screen.getByRole("region", { name: "Integrantes del equipo" });
    fireEvent.focusIn(region);
    avanzarTiempo();
    expect(scrollBy).not.toHaveBeenCalled();
    fireEvent.focusOut(region, { relatedTarget: document.body });
    avanzarTiempo();
    expect(scrollBy).toHaveBeenCalledTimes(1);
  });

  it("con «reducir movimiento» no avanza solo ni ofrece pausar", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("reduce"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    render(<EquipoTarjetas personas={EQUIPO} />);
    avanzarTiempo();
    expect(scrollBy).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /avance automático/ })).toBeNull();
  });
});
