import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";
import { usePage } from "@shared/a11y/focus";
import { apiFetch } from "@shared/api";

// Tipos y consultas de la API pública. Las claves deben coincidir con las que
// el servidor incluye en <script id="datos-iniciales"> (server/src/routes/landing.ts).

export interface Imagen {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface RedSocial {
  red: string;
  url: string;
  etiqueta?: string;
}

export interface Sitio {
  siteName: string;
  tagline: string | null;
  logos: { claro: Imagen | null; oscuro: Imagen | null };
  favicon: string | null;
  contacto: {
    telefono: string | null;
    correo: string | null;
    direccion: string | null;
    redes: RedSocial[];
  };
  accesibilidad: string;
}

export interface Seccion {
  key: string;
  content: Record<string, unknown>;
}

export interface NoticiaResumen {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  cover: Imagen | null;
}

export interface ListaNoticias {
  items: NoticiaResumen[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
}

export interface NoticiaDetalle extends NoticiaResumen {
  author: string;
  updatedAt: string;
  bodyHtml: string;
  lectura: { palabras: number; minutosLectura: number } | null;
}

export interface Persona {
  name: string;
  position: string;
  bio: string | null;
  links: RedSocial[];
  photo: Imagen | null;
}

export interface Colaborador {
  name: string;
  description: string | null;
  url: string | null;
  logo: Imagen | null;
}

export type SlugPagina = "inicio" | "nosotros" | "noticias" | "contacto";

const MINUTO = 60_000;

export const consultas = {
  sitio: () =>
    queryOptions({ queryKey: ["site"], queryFn: () => apiFetch<Sitio>("/api/public/site") }),
  pagina: (slug: SlugPagina) =>
    queryOptions({
      queryKey: ["pagina", slug],
      queryFn: () => apiFetch<{ secciones: Seccion[] }>(`/api/public/pages/${slug}`),
    }),
  noticias: (q: { pagina: number; porPagina: number }) =>
    queryOptions({
      queryKey: ["noticias", q],
      queryFn: () =>
        apiFetch<ListaNoticias>(`/api/public/news?pagina=${q.pagina}&porPagina=${q.porPagina}`),
    }),
  noticia: (slug: string) =>
    queryOptions({
      queryKey: ["noticia", slug],
      queryFn: () =>
        apiFetch<{ news: NoticiaDetalle }>(`/api/public/news/${encodeURIComponent(slug)}`),
    }),
  equipo: () =>
    queryOptions({
      queryKey: ["equipo"],
      queryFn: () => apiFetch<{ items: Persona[] }>("/api/public/team"),
    }),
  colaboradores: () =>
    queryOptions({
      queryKey: ["colaboradores"],
      queryFn: () => apiFetch<{ items: Colaborador[] }>("/api/public/collaborators"),
    }),
};

export const POR_PAGINA_NOTICIAS = 9;
export const NOTICIAS_EN_INICIO = 3;

export function crearQueryClient() {
  const cliente = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: MINUTO,
        // Un 404 no se reintenta; los errores de red, una vez.
        retry: (intentos, error) =>
          intentos < 1 &&
          !(error && "status" in error && (error as { status: number }).status === 404),
        refetchOnWindowFocus: false,
      },
    },
  });

  // Datos que el servidor incluyó en el HTML: el primer render no espera a la API.
  try {
    const bloque = document.getElementById("datos-iniciales")?.textContent;
    if (bloque) {
      const { consultas: iniciales } = JSON.parse(bloque) as { consultas: [unknown[], unknown][] };
      for (const [clave, datos] of iniciales) cliente.setQueryData(clave, datos);
    }
  } catch {
    // Datos iniciales ilegibles: se piden a la API como siempre.
  }
  return cliente;
}

// Título del documento con el nombre del sitio configurado en el panel, con el
// mismo formato que usa el servidor (server/src/routes/landing.ts).
export function useTituloPagina(titulo: string | null) {
  const { data: sitio } = useQuery(consultas.sitio());
  const nombre = sitio?.siteName ?? "SIGNAL";
  const completo = titulo
    ? `${titulo} · ${nombre}`
    : sitio?.tagline
      ? `${nombre} · ${sitio.tagline}`
      : nombre;
  return usePage(completo, completo);
}
