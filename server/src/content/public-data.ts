import type { Page } from "../generated/prisma/enums.js";
import type { Db } from "../lib/prisma.js";
import { SLUG_REGEX } from "../lib/slug.js";
import { parseFooter, type Footer } from "./footer.js";
import { parseVoice } from "./voice.js";
import { publicSectionImages, type ImagenPublica } from "./section-images.js";
import { conAudiodescripcionInicial } from "./sections.js";
import { PUBLIC_NEWS_INCLUDE, toNewsCard, toNewsDetail } from "./news-view.js";
import type { ClaveTipoRecurso } from "./resource-kinds.js";
import { FONT_OPTIONS, type Fonts } from "./theme.js";

// Consultas de solo lectura de la landing. Las usan la API pública (/api/public)
// y el servidor al entregar el HTML con los datos iniciales ya incluidos.
// Solo devuelven lo publicado y visible, y nunca ids ni datos internos.

export const PAGINAS: Record<string, Page> = {
  inicio: "INICIO",
  nosotros: "NOSOTROS",
  noticias: "NOTICIAS",
  contacto: "CONTACTO",
  recursos: "RECURSOS",
  galeria: "GALERIA",
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

type PiePublico = Omit<Footer, "logo" | "imagen"> & {
  logo?: ImagenPublica;
  imagen?: ImagenPublica;
};

export async function getSite(db: Db) {
  const [s, respaldos, modulos] = await Promise.all([
    db.siteSettings.findUnique({
      where: { id: 1 },
      include: { logoLight: IMAGEN, logoDark: IMAGEN, favicon: IMAGEN },
    }),
    getBackers(db),
    getModulos(db),
  ]);
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
    // Logo e imagen del pie como en las secciones: URL, tamaño y alt, sin ids internos.
    pie: publicSectionImages(parseFooter(s.footer)) as PiePublico,
    voz: parseVoice(s.voice),
    // Van en el pie de todas las páginas: llegan con los datos del sitio.
    respaldos,
    // Qué módulos tienen contenido publicado: el encabezado solo enlaza a los que lo tienen.
    modulos,
  };
}

// Un módulo (Recursos, Galería) aparece en la navegación solo cuando tiene algo que mostrar.
async function getModulos(db: Db) {
  const [recursos, galeria] = await Promise.all([
    db.resource.count({ where: { visible: true } }),
    db.galleryItem.count({ where: { visible: true } }),
  ]);
  return { recursos: recursos > 0, galeria: galeria > 0 };
}

export type PublicSite = NonNullable<Awaited<ReturnType<typeof getSite>>>;

export async function getPage(db: Db, page: Page) {
  const secciones = await db.section.findMany({
    where: { page, visible: true },
    orderBy: { order: "asc" },
    select: { key: true, content: true },
  });
  return {
    secciones: secciones.map((s) => ({
      key: s.key,
      content: publicSectionImages(soloHtml(conAudiodescripcionInicial(s.key, s.content))),
    })),
  };
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
      area: m.area,
      education: m.education,
      affiliation: m.affiliation,
      category: m.category,
      email: m.email,
      links: m.links,
      photo: m.photo ? { ...m.photo, alt: m.photoAlt ?? "" } : null,
      photoFrame: m.photoFrame,
    })),
  };
}

// Instituciones que respaldan el proyecto, sin ids internos.
async function getBackers(db: Db) {
  const filas = await db.backer.findMany({
    where: { visible: true },
    orderBy: { order: "asc" },
    include: { logo: IMAGEN },
  });
  return filas.map((r) => ({
    name: r.name,
    kind: r.kind,
    description: r.description,
    url: r.url,
    logo: r.logo ? { ...r.logo, alt: r.logoAlt ?? r.name } : null,
  }));
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
      type: c.type,
      logo: c.logo ? { ...c.logo, alt: c.logoAlt ?? c.name } : null,
    })),
  };
}

export interface ConsultaRecursos {
  pagina: number;
  porPagina: number;
  tipo?: ClaveTipoRecurso;
  q?: string;
}

// Fecha sin hora (columna DATE) como «2026-03-15».
const soloFecha = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function getResources(db: Db, q: ConsultaRecursos) {
  const texto = q.q?.trim();
  const where = {
    visible: true,
    kind: q.tipo,
    ...(texto && {
      OR: [
        { title: { contains: texto, mode: "insensitive" as const } },
        { description: { contains: texto, mode: "insensitive" as const } },
        { authors: { contains: texto, mode: "insensitive" as const } },
      ],
    }),
  };
  const [total, filas] = await Promise.all([
    db.resource.count({ where }),
    db.resource.findMany({
      where,
      // Primero lo más reciente; lo que no trae fecha, por orden de carga.
      orderBy: [
        { publishedOn: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: (q.pagina - 1) * q.porPagina,
      take: q.porPagina,
      include: { file: { select: { url: true, sizeBytes: true, mimeType: true } } },
    }),
  ]);
  return {
    items: filas.map((r) => ({
      title: r.title,
      description: r.description,
      kind: r.kind,
      authors: r.authors,
      publishedOn: soloFecha(r.publishedOn),
      doi: r.doi,
      doiUrl: r.doi ? `https://doi.org/${r.doi}` : null,
      externalUrl: r.externalUrl,
      license: r.license,
      file: r.file,
    })),
    pagina: q.pagina,
    porPagina: q.porPagina,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / q.porPagina)),
  };
}

export async function getGallery(db: Db) {
  const filas = await db.galleryItem.findMany({
    where: { visible: true },
    orderBy: { order: "asc" },
    include: { media: { select: { url: true, width: true, height: true } } },
  });
  return {
    items: filas.map((g) => ({
      name: g.name,
      credit: g.credit,
      image: { ...g.media, alt: g.alt },
    })),
  };
}
