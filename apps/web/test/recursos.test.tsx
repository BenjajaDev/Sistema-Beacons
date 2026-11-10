import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import type { Recurso } from "../src/public/data";
import { Layout } from "../src/public/Layout";
import Recursos from "../src/public/pages/Recursos";
import { expectNoAxeViolations } from "./axe";

const sitio = (recursos: boolean) => ({
  siteName: "SIGNAL",
  tagline: "Navegación interior accesible",
  logos: { claro: null, oscuro: null },
  favicon: null,
  contacto: { telefono: null, correo: null, direccion: null, redes: [] },
  accesibilidad: "Este sitio busca cumplir WCAG 2.1 AA.",
  modulos: { recursos },
});

const recurso = (extra: Partial<Recurso> = {}): Recurso => ({
  title: "Informe de impacto 2026",
  description: "Resultados del primer año.",
  kind: "REPORT",
  authors: "Equipo SIGNAL",
  publishedOn: "2026-06-01",
  doi: null,
  doiUrl: null,
  externalUrl: null,
  license: "CC BY 4.0",
  file: {
    url: "https://cdn.example.cl/informe.pdf",
    sizeBytes: 2.3 * 1024 * 1024,
    mimeType: "application/pdf",
  },
  ...extra,
});

const lista = (items: Recurso[], total = items.length) => ({
  items,
  pagina: 1,
  porPagina: 12,
  total,
  totalPaginas: 1,
});

function montar(ruta: string, consulta: object, datos: unknown, conRecursos = true) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  cliente.setQueryData(["site"], sitio(conRecursos));
  cliente.setQueryData(["pagina", "recursos"], {
    secciones: [
      { key: "recursos", content: { titulo: "Recursos", intro: "Documentos abiertos." } },
    ],
  });
  cliente.setQueryData(["recursos", consulta], datos);
  const router = createMemoryRouter(
    [{ Component: Layout, children: [{ path: "recursos", Component: Recursos }] }],
    { initialEntries: [ruta] },
  );
  return render(
    <QueryClientProvider client={cliente}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("Recursos", () => {
  it("muestra cada recurso con sus accesos y pasa axe", async () => {
    const { container } = montar(
      "/recursos",
      { pagina: 1, porPagina: 12 },
      lista([
        recurso(),
        recurso({
          title: "Artículo en revista",
          kind: "ARTICLE",
          file: null,
          doi: "10.1234/abcd",
          doiUrl: "https://doi.org/10.1234/abcd",
          externalUrl: "https://repositorio.uchile.cl/x",
          publishedOn: null,
        }),
      ]),
    );
    expect(screen.getByRole("heading", { level: 1, name: "Recursos" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Informe de impacto 2026" }),
    ).toBeInTheDocument();

    const pdf = screen.getByRole("link", {
      name: /Abrir PDF .*Informe de impacto 2026.*2,3 MB.*pestaña nueva/,
    });
    expect(pdf).toHaveAttribute("href", "https://cdn.example.cl/informe.pdf");
    expect(pdf).toHaveAttribute("rel", "noopener noreferrer");

    const doi = screen.getByRole("link", { name: /Ver por DOI: 10\.1234\/abcd.*pestaña nueva/ });
    expect(doi).toHaveAttribute("href", "https://doi.org/10.1234/abcd");
    expect(screen.getByRole("link", { name: /Ver en el repositorio/ })).toHaveAttribute(
      "href",
      "https://repositorio.uchile.cl/x",
    );
    // La fecha de un día se lee igual en cualquier zona horaria.
    expect(screen.getByText("1 de junio de 2026")).toHaveAttribute("datetime", "2026-06-01");
    expect(screen.getAllByText("Licencia: CC BY 4.0")).toHaveLength(2);
    await expectNoAxeViolations(container);
  });

  it("anuncia el resultado y marca el tipo elegido; ignora un tipo inventado", async () => {
    const { container, unmount } = montar(
      "/recursos?tipo=GUIDE&q=instal",
      { pagina: 1, porPagina: 12, tipo: "GUIDE", q: "instal" },
      lista([recurso({ title: "Guía de instalación", kind: "GUIDE" })]),
    );
    expect(container.querySelector(".recursos__resultado")).toHaveTextContent("1 recurso");
    const tipos = screen.getByRole("navigation", { name: "Tipos de recurso" });
    expect(within(tipos).getAllByRole("link")).toHaveLength(6);
    expect(within(tipos).getByRole("link", { name: "Guía y manual" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Cambiar de tipo conserva la búsqueda.
    expect(within(tipos).getByRole("link", { name: "Informe" })).toHaveAttribute(
      "href",
      "/recursos?tipo=REPORT&q=instal",
    );
    expect(screen.getByRole("searchbox", { name: /Buscar por título/ })).toHaveValue("instal");
    await expectNoAxeViolations(container);
    unmount();

    montar("/recursos?tipo=VIDEO", { pagina: 1, porPagina: 12 }, lista([recurso()]));
    expect(
      within(screen.getByRole("navigation", { name: "Tipos de recurso" })).getByRole("link", {
        name: "Todos",
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("busca con el formulario y sin resultados explica qué hacer", async () => {
    const usuario = userEvent.setup();
    const { container } = montar(
      "/recursos?q=nada",
      { pagina: 1, porPagina: 12, q: "nada" },
      lista([], 0),
    );
    expect(screen.getByText("No encontramos recursos con ese filtro")).toBeInTheDocument();
    expect(container.querySelector(".recursos__resultado")).toHaveTextContent("0 recursos");
    const campo = screen.getByRole("searchbox");
    await usuario.clear(campo);
    await usuario.type(campo, "guía{enter}");
    // La búsqueda cambia la dirección; sin datos en caché pasa a «cargando».
    expect(screen.getByRole("search", { name: "Buscar recursos" })).toBeInTheDocument();
  });

  it("el menú enlaza a Recursos solo cuando hay recursos publicados", () => {
    const { unmount } = montar("/recursos", { pagina: 1, porPagina: 12 }, lista([recurso()]), true);
    expect(
      within(screen.getByRole("navigation", { name: "Principal" })).getByRole("link", {
        name: "Recursos",
      }),
    ).toBeInTheDocument();
    unmount();
    montar("/recursos", { pagina: 1, porPagina: 12 }, lista([recurso()]), false);
    expect(
      within(screen.getByRole("navigation", { name: "Principal" })).queryByRole("link", {
        name: "Recursos",
      }),
    ).toBeNull();
  });
});
