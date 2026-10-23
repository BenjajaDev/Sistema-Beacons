import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BotonVoz } from "@shared/voz/BotonVoz";
import { expectNoAxeViolations } from "./axe";

// jsdom no trae Web Speech API: se simula lo justo para ver qué se lee.
class FraseFalsa {
  lang = "";
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

let dichas: FraseFalsa[] = [];
const sintesis = {
  speak: vi.fn((f: FraseFalsa) => dichas.push(f)),
  cancel: vi.fn(() => {
    // Como el navegador: cancelar termina la lectura en curso.
    for (const f of dichas.splice(0)) f.onend?.();
  }),
  getVoices: () => [{ lang: "es-CL", name: "Chile" }],
};

beforeEach(() => {
  dichas = [];
  vi.stubGlobal("speechSynthesis", sintesis);
  vi.stubGlobal("SpeechSynthesisUtterance", FraseFalsa);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("botón de voz", () => {
  it("lee el texto en español de Chile y, mientras suena, ofrece detenerlo", async () => {
    const usuario = userEvent.setup();
    const { container } = render(
      <BotonVoz
        texto="Un beacon sobre la puerta."
        etiqueta="Escuchar la descripción de la imagen"
      />,
    );
    await usuario.click(
      screen.getByRole("button", { name: "Escuchar la descripción de la imagen" }),
    );
    expect(dichas).toHaveLength(1);
    expect(dichas[0]!.text).toBe("Un beacon sobre la puerta.");
    expect(dichas[0]!.lang).toBe("es-CL");

    const detener = screen.getByRole("button", { name: "Detener la lectura" });
    await expectNoAxeViolations(container);
    await usuario.click(detener);
    expect(sintesis.cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Escuchar la descripción de la imagen" })).toBe(
      detener,
    );
  });

  it("vuelve a «Escuchar» cuando la lectura termina sola", async () => {
    const usuario = userEvent.setup();
    render(<BotonVoz texto="Hola" etiqueta="Escuchar esta sección" variante="texto" />);
    await usuario.click(screen.getByRole("button", { name: "Escuchar esta sección" }));
    expect(screen.getByRole("button", { name: "Detener la lectura" })).toBeInTheDocument();
    act(() => dichas[0]!.onend?.());
    expect(screen.getByRole("button", { name: "Escuchar esta sección" })).toBeInTheDocument();
  });

  it("suena una sola lectura a la vez", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <BotonVoz texto="Primera" etiqueta="Escuchar la primera" />
        <BotonVoz texto="Segunda" etiqueta="Escuchar la segunda" />
      </>,
    );
    await usuario.click(screen.getByRole("button", { name: "Escuchar la primera" }));
    await usuario.click(screen.getByRole("button", { name: "Escuchar la segunda" }));
    expect(screen.getAllByRole("button", { name: "Detener la lectura" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Escuchar la primera" })).toBeInTheDocument();
    expect(dichas.map((f) => f.text)).toEqual(["Segunda"]);
  });

  it("no aparece sin texto ni sin voz en el navegador", () => {
    const { rerender } = render(<BotonVoz texto="  " etiqueta="Escuchar" />);
    expect(screen.queryByRole("button")).toBeNull();
    vi.unstubAllGlobals();
    rerender(<BotonVoz texto="Algo" etiqueta="Escuchar" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
