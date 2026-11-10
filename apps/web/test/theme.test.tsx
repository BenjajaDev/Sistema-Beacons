import { readFileSync } from "node:fs";
import path from "node:path";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { contrastRatio, DEFAULT_PALETTE } from "@server-theme";
import { TextSizeControl, ThemeSwitcher, ZoomControl } from "@shared/theme/Controls";
import {
  aplicarFuente,
  aplicarGuia,
  aplicarTema,
  aplicarZoom,
  restablecerPreferencias,
} from "@shared/theme/preferences";
import { expectNoAxeViolations } from "./axe";

describe("selector de tema", () => {
  it("es un grupo de radios con nombre y guarda la elección", async () => {
    const usuario = userEvent.setup();
    const { container } = render(<ThemeSwitcher />);
    const grupo = screen.getByRole("group", { name: "Tema de colores" });
    expect(grupo).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Según el sistema" })).toBeChecked();

    await usuario.click(screen.getByRole("radio", { name: "Oscuro" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("signal-tema")).toBe("oscuro");

    await usuario.click(screen.getByRole("radio", { name: "Según el sistema" }));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    await expectNoAxeViolations(container);
  });
});

describe("alto contraste", () => {
  it("es una opción más del selector: tema oscuro con atributo propio, y se puede dejar", async () => {
    const usuario = userEvent.setup();
    const { container } = render(<ThemeSwitcher altoContraste conTexto />);
    // Con texto, el nombre de cada opción está a la vista (no solo para el lector).
    expect(screen.getByText("Alto contraste")).not.toHaveClass("visually-hidden");

    await usuario.click(screen.getByRole("radio", { name: "Alto contraste" }));
    const raiz = document.documentElement;
    // data-theme="dark" para que valgan las reglas del tema oscuro (logos, pie).
    expect(raiz).toHaveAttribute("data-theme", "dark");
    expect(raiz).toHaveAttribute("data-contraste");
    expect(localStorage.getItem("signal-tema")).toBe("contraste");

    await usuario.click(screen.getByRole("radio", { name: "Claro" }));
    expect(raiz).toHaveAttribute("data-theme", "light");
    expect(raiz).not.toHaveAttribute("data-contraste");
    await expectNoAxeViolations(container);
  });

  it("sin la opción, el selector sigue con tres temas y los nombres ocultos", () => {
    render(<ThemeSwitcher />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByText("Oscuro")).toHaveClass("visually-hidden");
  });
});

describe("restablecer las preferencias", () => {
  it("vuelve todo a lo del sistema y los controles se actualizan solos", () => {
    const raiz = document.documentElement;
    render(
      <>
        <ThemeSwitcher altoContraste />
        <ZoomControl />
      </>,
    );
    act(() => {
      aplicarTema("contraste");
      aplicarFuente("dislexia");
      aplicarGuia(true);
      aplicarZoom(1.5);
    });
    expect(screen.getByRole("radio", { name: "Alto contraste" })).toBeChecked();
    expect(screen.getByRole("group", { name: "Zoom de la página" })).toHaveTextContent("150 %");
    expect(raiz).toHaveAttribute("data-fuente", "dislexia");

    act(() => restablecerPreferencias());
    expect(screen.getByRole("radio", { name: "Según el sistema" })).toBeChecked();
    expect(screen.getByRole("group", { name: "Zoom de la página" })).toHaveTextContent("100 %");
    expect(raiz).not.toHaveAttribute("data-theme");
    expect(raiz).not.toHaveAttribute("data-contraste");
    expect(raiz).not.toHaveAttribute("data-fuente");
    expect(localStorage.getItem("signal-guia")).toBeNull();
    expect(raiz.style.getPropertyValue("--zoom-pagina")).toBe("");
  });
});

describe("theme-init.js (antes del primer pintado)", () => {
  const script = readFileSync(
    path.resolve(import.meta.dirname, "../src/shared/theme/theme-init.js"),
    "utf-8",
  );
  const ejecutar = () => new Function(script)();

  it("aplica alto contraste y fuente para dislexia desde lo guardado", () => {
    localStorage.setItem("signal-tema", "contraste");
    localStorage.setItem("signal-fuente", "dislexia");
    ejecutar();
    const raiz = document.documentElement;
    expect(raiz).toHaveAttribute("data-theme", "dark");
    expect(raiz).toHaveAttribute("data-contraste");
    expect(raiz).toHaveAttribute("data-fuente", "dislexia");
  });

  it("ignora valores desconocidos", () => {
    localStorage.setItem("signal-tema", "neon");
    localStorage.setItem("signal-fuente", "comic");
    ejecutar();
    const raiz = document.documentElement;
    expect(raiz).not.toHaveAttribute("data-theme");
    expect(raiz).not.toHaveAttribute("data-fuente");
  });
});

describe("tamaño de texto", () => {
  it("A+ y A− escalan el texto, lo anuncian y respetan los límites", async () => {
    const usuario = userEvent.setup();
    const { container } = render(<TextSizeControl />);
    const mas = screen.getByRole("button", { name: /^A\+/ });
    const menos = screen.getByRole("button", { name: /^A−/ });

    await usuario.click(mas);
    expect(document.documentElement.style.fontSize).toBe("112.5%");
    expect(screen.getByRole("status")).toHaveTextContent("Texto al 113 %");
    expect(localStorage.getItem("signal-texto")).toBe("1.125");

    for (let i = 0; i < 5; i++) await usuario.click(mas);
    expect(document.documentElement.style.fontSize).toBe("150%");
    expect(mas).toHaveAttribute("aria-disabled", "true");
    // En el límite sigue enfocable (no se pierde el foco al llegar al máximo).
    expect(mas).toHaveFocus();

    for (let i = 0; i < 6; i++) await usuario.click(menos);
    expect(document.documentElement.style.fontSize).toBe("87.5%");
    expect(menos).toHaveAttribute("aria-disabled", "true");
    await expectNoAxeViolations(container);
  });
});

describe("zoom de la página", () => {
  it("Zoom+ y Zoom− muestran el porcentaje, lo anuncian, lo guardan y respetan los límites", async () => {
    const usuario = userEvent.setup();
    const { container } = render(<ZoomControl />);
    expect(screen.getByRole("group", { name: "Zoom de la página" })).toHaveTextContent("100 %");
    const mas = screen.getByRole("button", { name: /^Zoom\+/ });
    const menos = screen.getByRole("button", { name: /^Zoom−/ });

    await usuario.click(mas);
    expect(document.documentElement.style.getPropertyValue("--zoom-pagina")).toBe("1.1");
    expect(screen.getByRole("status")).toHaveTextContent("Zoom al 110 %");
    expect(localStorage.getItem("signal-zoom")).toBe("1.1");

    for (let i = 0; i < 8; i++) await usuario.click(mas);
    expect(screen.getByRole("status")).toHaveTextContent("Zoom al 200 %");
    expect(mas).toHaveAttribute("aria-disabled", "true");
    expect(mas).toHaveFocus();

    for (let i = 0; i < 8; i++) await usuario.click(menos);
    expect(screen.getByRole("status")).toHaveTextContent("Zoom al 80 %");
    expect(menos).toHaveAttribute("aria-disabled", "true");
    await usuario.click(mas);
    await usuario.click(mas);
    // En 100 % no queda nada aplicado.
    expect(document.documentElement.style.getPropertyValue("--zoom-pagina")).toBe("");
    await expectNoAxeViolations(container);
  });
});

describe("tokens", () => {
  const css = readFileSync(
    path.resolve(import.meta.dirname, "../src/shared/styles/tokens.css"),
    "utf-8",
  );
  const valor = (bloque: string, nombre: string) => {
    const m = bloque.match(new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`));
    if (!m) throw new Error(`No se encontró --${nombre}`);
    return m[1]!;
  };
  const claro = css.slice(0, css.indexOf(':root[data-theme="dark"]'));
  const oscuro = css.slice(css.indexOf(':root[data-theme="dark"]'));

  it.each(["ok", "error", "aviso"])(
    "el color de estado «%s» cumple 4,5:1 en claro y en oscuro",
    (estado) => {
      expect(
        contrastRatio(valor(claro, `color-${estado}`), valor(claro, `color-${estado}-bg`)),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(valor(claro, `color-${estado}`), DEFAULT_PALETTE.light.fondo),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(valor(oscuro, `color-${estado}`), valor(oscuro, `color-${estado}-bg`)),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(valor(oscuro, `color-${estado}`), DEFAULT_PALETTE.dark.fondo),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("el CSS solo usa rem para tipografía y espacio (escala al 200 %)", () => {
    const enPx = [...css.matchAll(/--(text|space)-[\w-]+:\s*([^;]+);/g)].filter(([, , v]) =>
      /\dpx/.test(v!),
    );
    expect(enPx).toEqual([]);
  });
});
