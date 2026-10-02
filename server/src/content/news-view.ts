import type { Prisma } from "../generated/prisma/client.js";
import { docSchema, readingStats } from "./rich-text.js";

// Forma en que la landing recibe una noticia. La usan la API pública y la vista
// previa del panel, para que el borrador se vea exactamente como se publicará.

export const PUBLIC_NEWS_INCLUDE = {
  cover: { select: { url: true, width: true, height: true } },
  author: { select: { name: true } },
} satisfies Prisma.NewsInclude;

type NewsConRelaciones = Prisma.NewsGetPayload<{ include: typeof PUBLIC_NEWS_INCLUDE }>;

export function toNewsCard(n: NewsConRelaciones) {
  return {
    slug: n.slug,
    title: n.title,
    excerpt: n.excerpt,
    category: n.category,
    publishedAt: n.publishedAt,
    cover: n.cover
      ? { url: n.cover.url, alt: n.coverAlt ?? "", width: n.cover.width, height: n.cover.height }
      : null,
  };
}

export function toNewsDetail(n: NewsConRelaciones) {
  const doc = docSchema.safeParse(n.bodyJson);
  return {
    ...toNewsCard(n),
    author: n.author.name,
    updatedAt: n.updatedAt,
    bodyHtml: n.bodyHtml,
    lectura: doc.success ? readingStats(doc.data) : null,
  };
}
