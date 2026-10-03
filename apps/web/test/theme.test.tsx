import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { contrastRatio, DEFAULT_PALETTE } from "@server-theme";
import { TextSizeControl, ThemeSwitcher } from "@shared/theme/Controls";
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
