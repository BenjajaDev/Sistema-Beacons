// Las cinco categorías de la sala de prensa. Son fijas para que los filtros de
// «Noticias» no se llenen de variantes («Evento», «Eventos», «evento»…).
// apps/web/src/public/data.ts tiene la misma lista; un test verifica que coincidan.
export const CATEGORIAS_NOTICIA = [
  "Novedades",
  "Eventos y talleres",
  "Investigación",
  "En los medios",
  "Comunidad y alianzas",
] as const;
