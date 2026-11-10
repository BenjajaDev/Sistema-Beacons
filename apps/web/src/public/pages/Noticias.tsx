import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { mensajeDeError } from "@shared/api";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { Paginacion, TarjetaNoticia } from "../components";
import { KitPrensa, type ContenidoKit } from "../KitPrensa";
import { CATEGORIAS_NOTICIA, consultas, POR_PAGINA_NOTICIAS } from "../data";
import { PaginaSecciones } from "../sections";

function Listado({ pagina, categoria }: { pagina: number; categoria?: string }) {
  const { data, isPending, error, refetch } = useQuery(
    consultas.noticias({ pagina, porPagina: POR_PAGINA_NOTICIAS, categoria }),
  );
  if (isPending) {
    return (
      <Cargando etiqueta="Cargando noticias…">
        <div className="rejilla-noticias">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} alto="14rem" />
          ))}
        </div>
      </Cargando>
    );
  }
  if (error) return <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />;
  if (data.items.length === 0) {
    return (
      <EmptyState
        titulo={
          categoria
            ? `Todavía no hay noticias en «${categoria}»`
            : pagina > 1
              ? "No hay noticias en esta página"
              : "Todavía no hay noticias publicadas"
        }
        texto="Vuelve pronto para conocer las novedades del proyecto."
      />
    );
  }
  return (
    <>
      <ul className="rejilla-noticias">
        {data.items.map((n) => (
          <li key={n.slug}>
            <TarjetaNoticia noticia={n} nivel={2} />
          </li>
        ))}
      </ul>
      <Paginacion pagina={data.pagina} totalPaginas={data.totalPaginas} categoria={categoria} />
    </>
  );
}

// Filtro por categoría: enlaces (no botones) a /noticias?categoria=…, así cada filtro
// tiene su dirección y funciona con «Atrás» y al compartir.
function FiltroCategorias({ categoria }: { categoria?: string }) {
  return (
    <nav aria-label="Categorías de noticias" className="paginacion filtro-categorias">
      <ul>
        <li>
          <Link to="/noticias" aria-current={categoria ? undefined : "page"}>
            Todas
          </Link>
        </li>
        {CATEGORIAS_NOTICIA.map((c) => (
          <li key={c}>
            <Link
              to={`/noticias?categoria=${encodeURIComponent(c)}`}
              aria-current={categoria === c ? "page" : undefined}
            >
              {c}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function Noticias() {
  const [params] = useSearchParams();
  const { data: contenido } = useQuery(consultas.pagina("noticias"));
  // La sección del kit no es un bloque de la página: se muestra al final de la lista.
  const kit = contenido?.secciones.find((s) => s.key === "kit-prensa")?.content as
    ContenidoKit | undefined;
  const pagina = Math.max(1, Number(params.get("pagina")) || 1);
  // Una categoría que no es de la lista se ignora.
  const pedida = params.get("categoria") ?? "";
  const categoria = (CATEGORIAS_NOTICIA as readonly string[]).includes(pedida) ? pedida : undefined;
  return (
    <PaginaSecciones
      slug="noticias"
      tituloRespaldo="Noticias"
      tituloDocumento={
        categoria
          ? `Noticias: ${categoria}${pagina > 1 ? `, página ${pagina}` : ""}`
          : pagina > 1
            ? `Noticias, página ${pagina}`
            : "Noticias"
      }
    >
      <div className="container seccion">
        <FiltroCategorias categoria={categoria} />
        <Listado pagina={pagina} categoria={categoria} />
        {kit && <KitPrensa contenido={kit} />}
      </div>
    </PaginaSecciones>
  );
}
