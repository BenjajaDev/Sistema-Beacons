import type { Page } from "../generated/prisma/enums.js";
import type { Db } from "../lib/prisma.js";
import { SLUG_REGEX } from "../lib/slug.js";
import { parseFooter } from "./footer.js";
import { PUBLIC_NEWS_INCLUDE, toNewsCard, toNewsDetail } from "./news-view.js";
import { FONT_OPTIONS, type Fonts } from "./theme.js";

// Consultas de solo lectura de la landing. Las usan la API pública (/api/public)
// y el servidor al entregar el HTML con los datos iniciales ya incluidos.
// Solo devuelven lo publicado y visible, y nunca ids ni datos internos.

export const PAGINAS: Record<string, Page> = {
  inicio: "INICIO",
  nosotros: "NOSOTROS",
  noticias: "NOTICIAS",
  contacto: "CONTACTO",
};

const IMAGEN = { select: { url: true, width: true, height: true } } as const;

// El JSON del editor no hace falta en la landing: de los textos enriquecidos solo
// se envía el HTML ya saneado.
function soloHtml(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(soloHtml);
  if (valor && typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    if ("json" in obj && typeof obj.html === "string") return { html: obj.html };
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, soloHtml(v)]));
  }
  return valor;
}

export async function getSite(db: Db) {
  const s = await db.siteSettings.findUnique({
    where: { id: 1 },
    include: { logoLight: IMAGEN, logoDark: IMAGEN, favicon: IMAGEN },
  });
  if (!s) return null;
  const fuentes = s.fonts as Fonts;
  return {
    siteName: s.siteName,
    tagline: s.tagline,
    logos: {
      claro: s.logoLight ? { ...s.logoLight, alt: s.logoLightAlt ?? s.siteName } : null,
      oscuro: s.logoDark ? { ...s.logoDark, alt: s.logoDarkAlt ?? s.siteName } : null,
    },
    favicon: s.favicon?.url ?? null,
    palette: s.palette,
    fonts: {
      cuerpo: { id: fuentes.cuerpo, ...FONT_OPTIONS[fuentes.cuerpo] },
      titulos: { id: fuentes.titulos, ...FONT_OPTIONS[fuentes.titulos] },
    },
    contacto: {
      telefono: s.contactPhone,
      correo: s.contactEmail,
      direccion: s.contactAddress,
      redes: s.socials,
    },
    accesibilidad: s.accessibilityStatement,
    pie: parseFooter(s.footer),
  };
}

export type PublicSite = NonNullable<Awaited<ReturnType<typeof getSite>>>;

export async function getPage(db: Db, page: Page) {
  const secciones = await db.section.findMany({
    where: { page, visible: true },
    orderBy: { order: "asc" },
    select: { key: true, content: true },
  });
  return { secciones: secciones.map((s) => ({ key: s.key, content: soloHtml(s.content) })) };
}

export async function getNewsList(
  db: Db,
  q: { pagina: number; porPagina: number; categoria?: string },
) {
  const where = { status: "PUBLISHED" as const, category: q.categoria || undefined };
  const [total, filas] = await Promise.all([
    db.news.count({ where }),
    db.news.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: (q.pagina - 1) * q.porPagina,
      take: q.porPagina,
      include: PUBLIC_NEWS_INCLUDE,
    }),
  ]);
  return {
    items: filas.map(toNewsCard),
    pagina: q.pagina,
    porPagina: q.porPagina,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / q.porPagina)),
  };
}

export async function getNewsBySlug(db: Db, slug: string) {
  if (!SLUG_REGEX.test(slug)) return null;
  const n = await db.news.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: PUBLIC_NEWS_INCLUDE,
  });
  return n ? { news: toNewsDetail(n) } : null;
}

export async function getTeam(db: Db) {
  const filas = await db.teamMember.findMany({
    where: { visible: true },
    orderBy: { order: "asc" },
    include: { photo: IMAGEN },
  });
  return {
    items: filas.map((m) => ({
      name: m.name,
      position: m.position,
      bio: m.bio,
      links: m.links,
      photo: m.photo ? { ...m.photo, alt: m.photoAlt ?? "" } : null,
    })),
  };
}

export async function getCollaborators(db: Db) {
  const filas = await db.collaborator.findMany({
    where: { visible: true },
    orderBy: { order: "asc" },
    include: { logo: IMAGEN },
  });
  return {
    items: filas.map((c) => ({
      name: c.name,
      description: c.description,
      url: c.url,
      logo: c.logo ? { ...c.logo, alt: c.logoAlt ?? c.name } : null,
    })),
  };
}
