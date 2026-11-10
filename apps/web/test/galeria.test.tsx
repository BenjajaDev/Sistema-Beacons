import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import type { FotoGaleria } from "../src/public/data";
import { Layout } from "../src/public/Layout";
import Galeria from "../src/public/pages/Galeria";
import { expectNoAxeViolations } from "./axe";

const sitio = (galeria: boolean) => ({
  siteName: "SIGNAL",
  tagline: "Navegación interior accesible",
  logos: { claro: null, oscuro: null },
  favicon: null,
  contacto: { telefono: null, correo: null, direccion: null, redes: [] },
  accesibilidad: "Este sitio busca cumplir WCAG 2.1 AA.",
  modulos: { recursos: false, galeria },
});

const foto = (n: number, extra: Partial<FotoGaleria> = {}): FotoGaleria => ({
  name: `Taller ${n}`,
  credit: null,
  image: { url: `/uploads/${n}.webp`, alt: `Personas en el taller ${n}`, width: 800, height: 600 },
  ...extra,
});

function montar(fotos: FotoGaleria[], conGaleria = true) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  cliente.setQueryData(["site"], sitio(conGaleria));
  cliente.setQueryData(["pagina", "galeria"], {
    secciones: [
      { key: "galeria", content: { titulo: "Galería", intro: "Momentos del proyecto." } },
    ],
  });
  cliente.setQueryData(["galeria"], { items: fotos });
  const router = createMemoryRouter(
    [{ Component: Layout, children: [{ path: "galeria", Component: Galeria }] }],
    { initialEntries: ["/galeria"] },
  );
  return render(
    <QueryClientProvider client={cliente}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("Galería", () => {
  it("muestra cada foto con su texto alternativo, pie, crédito y enlace al tamaño completo", async () => {
    const { container } = montar([foto(1, { credit: "Foto: Ana Rojas" }), foto(2)]);
    expect(screen.getByRole("heading", { level: 1, name: "Galería" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Personas en el taller 1" })).toHaveAttribute(
      "src",
      "/uploads/1.webp",
    );
    expect(screen.getAllByRole("figure")).toHaveLength(2);
    expect(screen.getByText("Foto: Ana Rojas")).toBeInTheDocument();
    const completo = screen.getByRole("link", {
      name: /^Ver en tamaño completo la foto «Taller 1» \(se abre en una pestaña nueva\)$/,
    });
    expect(completo).toHaveAttribute("href", "/uploads/1.webp");
    expect(completo).toHaveAttribute("rel", "noopener noreferrer");
    await expectNoAxeViolations(container);
  });

  it("sin fotos explica que vuelvan pronto", async () => {
    const { container } = montar([]);
    expect(screen.getByText("Todavía no hay fotos")).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("el menú enlaza a la Galería solo cuando hay fotos publicadas", () => {
    const { unmount } = montar([foto(1)], true);
    expect(
      within(screen.getByRole("navigation", { name: "Principal" })).getByRole("link", {
        name: "Galería",
      }),
    ).toBeInTheDocument();
    unmount();
    montar([foto(1)], false);
    expect(
      within(screen.getByRole("navigation", { name: "Principal" })).queryByRole("link", {
        name: "Galería",
      }),
    ).toBeNull();
  });
});
