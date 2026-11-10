import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { KitPrensa } from "../src/public/KitPrensa";
import { expectNoAxeViolations } from "./axe";

const logo = { url: "/uploads/logo.png", alt: "Logotipo de SIGNAL", width: 200, height: 80 };
const sitio = {
  siteName: "SIGNAL",
  logos: { claro: logo, oscuro: null },
  favicon: null,
  contacto: { telefono: null, correo: null, direccion: null, redes: [] },
  accesibilidad: "",
};

function montar(items: object[]) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  cliente.setQueryData(["site"], sitio);
  cliente.setQueryData(["recursos", { pagina: 1, porPagina: 12, tipo: "PRESS_KIT" }], {
    items,
    pagina: 1,
    porPagina: 12,
    total: items.length,
    totalPaginas: 1,
  });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <KitPrensa
          contenido={{
            titulo: "Kit de prensa",
            descripcion: "SIGNAL orienta por voz.",
            contactoPrensa: "Ana Rojas",
            correoPrensa: "prensa@signal.cl",
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Kit de prensa", () => {
  it("muestra el texto, el contacto, los logotipos y los archivos con nombres claros", async () => {
    const { container } = montar([
      {
        title: "Dossier",
        description: "Fotos y datos.",
        kind: "PRESS_KIT",
        authors: null,
        publishedOn: null,
        doi: null,
        doiUrl: null,
        externalUrl: null,
        license: null,
        file: {
          url: "/uploads/documentos/d.pdf",
          sizeBytes: 1_500_000,
          mimeType: "application/pdf",
        },
      },
    ]);
    expect(screen.getByRole("heading", { level: 2, name: "Kit de prensa" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(screen.getByText("SIGNAL orienta por voz.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "prensa@signal.cl" })).toHaveAttribute(
      "href",
      "mailto:prensa@signal.cl",
    );
    expect(
      screen.getByRole("link", {
        name: "Logotipo para fondo claro (se abre en una pestaña nueva)",
      }),
    ).toHaveAttribute("href", "/uploads/logo.png");
    // Sin logotipo oscuro cargado, no se ofrece.
    expect(screen.queryByRole("link", { name: /fondo oscuro/ })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Dossier (PDF, 1,4 MB) (se abre en una pestaña nueva)" }),
    ).toHaveAttribute("href", "/uploads/documentos/d.pdf");
    await expectNoAxeViolations(container);
  });

  it("sin archivos omite ese apartado", () => {
    montar([]);
    expect(screen.queryByRole("heading", { name: "Material para descargar" })).toBeNull();
  });
});
