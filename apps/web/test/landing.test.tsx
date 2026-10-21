import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectarRed } from "../src/public/IconosRedes";
import { Layout } from "../src/public/Layout";
import Contacto from "../src/public/pages/Contacto";
import Inicio from "../src/public/pages/Inicio";
import NoEncontrada from "../src/public/pages/NoEncontrada";
import Noticia from "../src/public/pages/Noticia";
import Noticias from "../src/public/pages/Noticias";
import { expectNoAxeViolations } from "./axe";

const sitio = {
  siteName: "SIGNAL",
  tagline: "Navegación interior accesible",
  logos: { claro: null, oscuro: null },
  favicon: null,
  contacto: {
    telefono: "+56 9 1234 5678",
    correo: "hola@signal.cl",
    direccion: null,
    redes: [{ red: "Instagram", url: "https://instagram.com/signal" }],
  },
  accesibilidad: "Este sitio busca cumplir WCAG 2.1 AA.",
};

const inicio = {
  secciones: [
    {
      key: "hero",
      content: {
        titulo: "Orientarse con voz",
        bajada: "Bajada",
        accionPrincipal: { texto: "Cómo funciona", href: "#que-es" },
      },
    },
    {
      key: "que-es",
      content: {
        titulo: "Qué es SIGNAL",
        pasos: [1, 2, 3].map((n) => ({ titulo: `Paso ${n}`, texto: "x" })),
      },
    },
    { key: "no-existe-en-el-cliente", content: {} },
  ],
};

const noticia = (n: number) => ({
  slug: `nota-${n}`,
  title: `Nota ${n}`,
  excerpt: "Bajada",
  category: "Proyecto",
  publishedAt: "2026-10-01T12:00:00.000Z",
  cover: null,
});

function montar(ruta: string, datos: [unknown[], unknown][]) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  for (const [k, v] of datos) cliente.setQueryData(k, v);
  const router = createMemoryRouter(
    [
      {
        Component: Layout,
        children: [
          { index: true, Component: Inicio },
          { path: "noticias", Component: Noticias },
          { path: "noticias/:slug", Component: Noticia },
          { path: "contacto", Component: Contacto },
          { path: "*", Component: NoEncontrada },
        ],
      },
    ],
    { initialEntries: [ruta] },
  );
  return render(
    <QueryClientProvider client={cliente}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("Inicio", () => {
  it("tiene un solo h1 (la primera sección), landmarks y la página actual marcada", async () => {
    const { container } = montar("/", [
      [["site"], sitio],
      [["pagina", "inicio"], inicio],
    ]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Orientarse con voz");
    expect(screen.getByRole("heading", { level: 2, name: "Qué es SIGNAL" })).toBeInTheDocument();
    const principal = screen.getByRole("navigation", { name: "Principal" });
    expect(within(principal).getByRole("link", { name: "Inicio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Este sitio busca cumplir WCAG 2.1 AA.",
    );
    expect(screen.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute(
      "href",
      "#contenido",
    );
    // Mismo título que entrega el servidor.
    await waitFor(() => expect(document.title).toBe("SIGNAL · Navegación interior accesible"));
    await expectNoAxeViolations(container);
  });

  it("sin secciones visibles mantiene un h1", () => {
    montar("/", [
      [["site"], sitio],
      [["pagina", "inicio"], { secciones: [] }],
    ]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("SIGNAL");
  });
});

describe("pie de página", () => {
  it("usa el pie por defecto si los datos no lo traen y muestra las redes con nombre", () => {
    montar("/", [
      [["site"], sitio],
      [["pagina", "inicio"], { secciones: [] }],
    ]);
    const pie = screen.getByRole("contentinfo");
    expect(within(pie).getByRole("heading", { name: "Explora" })).toBeInTheDocument();
    expect(within(pie).getByRole("link", { name: "Nosotros" })).toHaveAttribute(
      "href",
      "/nosotros",
    );
    // El ícono es decorativo: el nombre accesible es el de la red.
    const red = within(pie).getByRole("link", { name: "Instagram" });
    expect(red.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("respeta lo editado: columnas, bloques ocultos y texto legal", () => {
    montar("/", [
      [
        ["site"],
        {
          ...sitio,
          pie: {
            descripcion: "Orientación con voz.",
            columnas: [{ titulo: "Proyecto", enlaces: [{ texto: "Equipo", href: "/nosotros" }] }],
            mostrarContacto: false,
            mostrarRedes: false,
            mostrarAccesibilidad: false,
            textoLegal: "Proyecto académico.",
          },
        },
      ],
      [["pagina", "inicio"], { secciones: [] }],
    ]);
    const pie = screen.getByRole("contentinfo");
    expect(within(pie).getByRole("heading", { name: "Proyecto" })).toBeInTheDocument();
    expect(within(pie).queryByRole("heading", { name: "Contacto" })).toBeNull();
    expect(within(pie).queryByRole("heading", { name: "Accesibilidad" })).toBeNull();
    expect(within(pie).queryByRole("link", { name: "Instagram" })).toBeNull();
    expect(pie).toHaveTextContent("Proyecto académico.");
  });
});

describe("íconos de redes", () => {
  it("reconoce la red por el nombre o por el dominio", () => {
    expect(detectarRed("Instagram", "https://example.com")).toBe("instagram");
    expect(detectarRed("Mi perfil", "https://www.linkedin.com/in/x")).toBe("linkedin");
    expect(detectarRed("X", "https://x.com/signal")).toBe("x");
    expect(detectarRed("Twitter", "https://twitter.com/signal")).toBe("x");
    expect(detectarRed("Chat", "https://wa.me/56912345678")).toBe("whatsapp");
    expect(detectarRed("Sitio", "https://signal.cl")).toBe("web");
  });
});

describe("menú móvil", () => {
  it("indica si está abierto y Escape lo cierra devolviendo el foco", async () => {
    const usuario = userEvent.setup();
    montar("/", [
      [["site"], sitio],
      [["pagina", "inicio"], inicio],
    ]);
    const boton = screen.getByRole("button", { name: "Menú" });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    await usuario.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    await usuario.keyboard("{Escape}");
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(boton).toHaveFocus();
  });
});

describe("Noticias", () => {
  it("lista con paginación accesible", async () => {
    const { container } = montar("/noticias?pagina=2", [
      [["site"], sitio],
      [
        ["pagina", "noticias"],
        { secciones: [{ key: "noticias", content: { titulo: "Noticias" } }] },
      ],
      [
        ["noticias", { pagina: 2, porPagina: 9 }],
        { items: [noticia(10), noticia(11)], pagina: 2, porPagina: 9, total: 11, totalPaginas: 2 },
      ],
    ]);
    expect(screen.getByRole("heading", { level: 1, name: "Noticias" })).toBeInTheDocument();
    // Las tarjetas son h2 bajo el h1 de la página, con un solo enlace cada una.
    expect(screen.getByRole("heading", { level: 2, name: "Nota 10" })).toBeInTheDocument();
    const paginacion = screen.getByRole("navigation", { name: "Paginación de noticias" });
    expect(within(paginacion).getByRole("link", { name: "Página 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(paginacion).getByRole("link", { name: /Anteriores/ })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("una noticia inexistente muestra la página «no encontrada»", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "La noticia no existe.", code: "NOT_FOUND" }), {
        status: 404,
      }),
    );
    montar("/noticias/no-existe", [[["site"], sitio]]);
    expect(
      await screen.findByRole("heading", { level: 1, name: "No encontramos esta página" }),
    ).toBeInTheDocument();
  });
});

describe("formulario de contacto", () => {
  const datos: [unknown[], unknown][] = [
    [["site"], sitio],
    [
      ["pagina", "contacto"],
      {
        secciones: [
          {
            key: "contacto",
            content: {
              titulo: "Contacto",
              formularioTitulo: "Escríbenos",
              mensajeExito: "¡Recibido!",
            },
          },
        ],
      },
    ],
  ];

  it("al enviar vacío resume los errores, los enfoca y marca cada campo", async () => {
    const usuario = userEvent.setup();
    const espia = vi.spyOn(globalThis, "fetch");
    const { container } = montar("/contacto", datos);
    await usuario.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    // Hay dos role="alert": el resumen y la región de avisos, que existe siempre vacía.
    const resumen = screen.getByText(/Revisa estos campos/).closest("[role=alert]") as HTMLElement;
    expect(resumen).toHaveFocus();
    expect(within(resumen).getAllByRole("link")).toHaveLength(3);
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Teléfono (opcional)")).not.toHaveAttribute("aria-invalid");
    expect(espia).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  it("valida al salir del campo y quita el error al corregirlo", async () => {
    const usuario = userEvent.setup();
    montar("/contacto", datos);
    const correo = screen.getByLabelText("Correo electrónico");
    await usuario.type(correo, "no-es-correo");
    await usuario.tab();
    expect(correo).toHaveAccessibleDescription(/correo válido/);
    await usuario.clear(correo);
    await usuario.type(correo, "ana@correo.cl");
    expect(correo).not.toHaveAttribute("aria-invalid");
  });

  it("muestra los errores del servidor junto al campo y no pierde lo escrito", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Revisa",
          code: "VALIDATION",
          campos: { correo: "Ese dominio no existe." },
        }),
        { status: 400 },
      ),
    );
    montar("/contacto", datos);
    await usuario.type(screen.getByLabelText("Nombre"), "Ana");
    await usuario.type(screen.getByLabelText("Correo electrónico"), "ana@x.cl");
    await usuario.type(screen.getByLabelText("Mensaje"), "Quiero conocer el proyecto.");
    await usuario.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    expect(await screen.findByLabelText("Correo electrónico")).toHaveAccessibleDescription(
      "Ese dominio no existe.",
    );
    expect(screen.getByLabelText("Mensaje")).toHaveValue("Quiero conocer el proyecto.");
    expect(JSON.parse(sessionStorage.getItem("signal-contacto-borrador")!).nombre).toBe("Ana");
  });

  it("al enviarse confirma con el texto del panel y limpia el borrador", async () => {
    const usuario = userEvent.setup();
    const espia = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, mensaje: "¡Recibido!" }), { status: 201 }),
      );
    montar("/contacto", datos);
    await usuario.type(screen.getByLabelText("Nombre"), "Ana");
    await usuario.type(screen.getByLabelText("Correo electrónico"), "ana@correo.cl");
    await usuario.type(screen.getByLabelText("Mensaje"), "Quiero conocer el proyecto.");
    await usuario.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    const confirmacion = await screen.findByText("¡Recibido!");
    expect(confirmacion.closest("[tabindex='-1']")).toHaveFocus();
    const cuerpo = JSON.parse(String(espia.mock.calls[0]![1]!.body));
    expect(cuerpo).toMatchObject({ nombre: "Ana", correo: "ana@correo.cl" });
    expect(cuerpo.sitioWeb).toBeUndefined();
    expect(sessionStorage.getItem("signal-contacto-borrador")).toBe(
      JSON.stringify({ nombre: "", correo: "", telefono: "", asunto: "", mensaje: "" }),
    );
  });
});
