import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { Colaborador, Persona } from "../src/public/data";
import { detectarRed } from "../src/public/IconosRedes";
import { RENDERIZADORES } from "../src/public/sections";
import { expectNoAxeViolations } from "./axe";

const persona = (name: string, extra: Partial<Persona> = {}): Persona => ({
  name,
  position: "Investigación",
  bio: null,
  area: null,
  education: null,
  affiliation: null,
  category: "CORE",
  email: null,
  links: [],
  photo: null,
  photoFrame: null,
  ...extra,
});

const colaborador = (name: string, type: Colaborador["type"]): Colaborador => ({
  name,
  description: null,
  url: `https://${name.toLowerCase().replaceAll(" ", "")}.cl`,
  type,
  logo: null,
});

function montar(key: string, datos: [string, unknown]) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  cliente.setQueryData([datos[0]], { items: datos[1] });
  const Vista = RENDERIZADORES[key] as ComponentType<{
    contenido: object;
    nivel: 1 | 2;
    idTitulo: string;
  }>;
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <Vista contenido={{ titulo: "Sección" }} nivel={2} idTitulo="t" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Nosotros: grupos del equipo", () => {
  it("con un solo grupo no agrega subtítulos y los nombres siguen siendo h3", () => {
    montar("equipo", ["equipo", [persona("Ana"), persona("Luis")]]);
    expect(screen.queryByRole("heading", { level: 4 })).toBeNull();
    expect(screen.getByRole("heading", { level: 3, name: "Ana" })).toBeInTheDocument();
  });

  it("con varios grupos los rotula en orden y baja los nombres a h4", async () => {
    const { container } = montar("equipo", [
      "equipo",
      [
        persona("Estela", { category: "STUDENTS" }),
        persona("Ana"),
        persona("Marcos", { category: "ADVISORY", affiliation: "Universidad de Chile" }),
      ],
    ]);
    const grupos = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(grupos).toEqual(["Equipo", "Comité consultivo", "Estudiantes"]);
    const comite = screen.getByRole("heading", { level: 3, name: "Comité consultivo" })
      .parentElement as HTMLElement;
    expect(within(comite).getByRole("heading", { level: 4, name: "Marcos" })).toBeInTheDocument();
    expect(within(comite).getByText("Universidad de Chile")).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe("Nosotros: colaboradores por tipo", () => {
  it("agrupa por tipo, deja «otras» al final y no muestra grupos vacíos", async () => {
    const { container } = montar("colaboradores", [
      "colaboradores",
      [
        colaborador("Taller Sur", "OTHER"),
        colaborador("Universidad Norte", "ACADEMIC"),
        colaborador("Fundación Ver", "CIVIL_SOCIETY"),
      ],
    ]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Instituciones académicas",
      "Organizaciones de la sociedad civil",
      "Otras organizaciones",
    ]);
    expect(container.querySelectorAll(".colaborador")).toHaveLength(3);
    await expectNoAxeViolations(container);
  });

  it("con un solo tipo no rotula", () => {
    montar("colaboradores", ["colaboradores", [colaborador("Taller Sur", "OTHER")]]);
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });
});

describe("íconos de redes académicas", () => {
  it("reconoce ORCID y ResearchGate por el nombre o por el dominio", () => {
    expect(detectarRed("ORCID", "https://orcid.org/0000-0002-1825-0097")).toBe("orcid");
    expect(detectarRed("Perfil", "https://orcid.org/0000-0002-1825-0097")).toBe("orcid");
    expect(detectarRed("ResearchGate", "https://example.cl/x")).toBe("researchgate");
    expect(detectarRed("Perfil", "https://www.researchgate.net/profile/Ana")).toBe("researchgate");
    expect(detectarRed("Sitio", "https://example.cl")).toBe("web");
  });
});
