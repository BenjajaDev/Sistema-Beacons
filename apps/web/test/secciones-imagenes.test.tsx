import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { RENDERIZADORES } from "../src/public/sections";
import { expectNoAxeViolations } from "./axe";

const imagen = (alt: string) => ({ url: "/uploads/a.webp", width: 800, height: 600, alt });

function montar(key: string, contenido: object, nivel: 1 | 2 = 2) {
  const Vista = RENDERIZADORES[key] as ComponentType<{
    contenido: object;
    nivel: 1 | 2;
    idTitulo: string;
  }>;
  return render(
    <MemoryRouter>
      <Vista contenido={contenido} nivel={nivel} idTitulo="t" />
    </MemoryRouter>,
  );
}

describe("imágenes en las secciones", () => {
  it("la portada muestra la imagen en lugar de las ondas y la carga con prioridad", async () => {
    const { container } = montar(
      "hero",
      { titulo: "Orientarse", bajada: "Bajada", imagen: imagen("Persona usando la app") },
      1,
    );
    const img = screen.getByRole("img", { name: "Persona usando la app" });
    expect(img).toHaveAttribute("loading", "eager");
    expect(container.querySelector(".hero__senal")).toBeNull();
    // Sin botones: no queda un contenedor de acciones vacío.
    expect(container.querySelector(".hero__acciones")).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("sin imagen, la portada conserva las ondas de la señal", () => {
    const { container } = montar("hero", { titulo: "Orientarse", bajada: "Bajada" }, 1);
    expect(container.querySelector(".hero__senal")).not.toBeNull();
  });

  it("una imagen decorativa no se anuncia", () => {
    const { container } = montar("objetivos", {
      titulo: "Objetivos",
      items: [{ titulo: "Autonomía", texto: "x", imagen: imagen("") }],
    });
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("los pasos se reparten en columnas según cuántos hay", () => {
    const pasos = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ titulo: `P${i}`, texto: "x" }));
    const columnas = (n: number) => {
      const { container, unmount } = montar("que-es", { titulo: "Qué es", pasos: pasos(n) });
      const valor = container.querySelector(".pasos")?.getAttribute("data-columnas");
      unmount();
      return valor;
    };
    expect([1, 2, 3, 4, 5, 6].map(columnas)).toEqual(["1", "2", "3", "2", "3", "3"]);
  });

  it("el bloque imagen y texto separa párrafos y pone la imagen al lado elegido", async () => {
    const { container } = montar("imagen-texto-nosotros", {
      titulo: "Cómo trabajamos",
      texto: "Primer párrafo.\n\nSegundo párrafo.",
      imagen: imagen("Equipo en una reunión"),
      posicion: "izquierda",
      accion: { texto: "Contáctanos", href: "/contacto" },
    });
    expect(screen.getByRole("heading", { name: "Cómo trabajamos" })).toBeInTheDocument();
    expect(screen.getByText("Primer párrafo.")).toBeInTheDocument();
    expect(screen.getByText("Segundo párrafo.")).toBeInTheDocument();
    expect(container.querySelector("[data-imagen]")).toHaveAttribute("data-imagen", "izquierda");
    // El texto va antes que la imagen en el DOM: el orden visual lo cambia el CSS.
    const [texto, figura] = container.querySelector(".dos-columnas")!.children;
    expect(texto).toHaveClass("imagen-texto__texto");
    expect(figura?.tagName).toBe("FIGURE");
    await expectNoAxeViolations(container);
  });
});
