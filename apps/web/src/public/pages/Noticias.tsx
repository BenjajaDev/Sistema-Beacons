import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { mensajeDeError } from "@shared/api";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { Paginacion, TarjetaNoticia } from "../components";
import { consultas, POR_PAGINA_NOTICIAS } from "../data";
import { PaginaSecciones } from "../sections";

function Listado({ pagina }: { pagina: number }) {
  const { data, isPending, error, refetch } = useQuery(
    consultas.noticias({ pagina, porPagina: POR_PAGINA_NOTICIAS }),
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
          pagina > 1 ? "No hay noticias en esta página" : "Todavía no hay noticias publicadas"
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
      <Paginacion pagina={data.pagina} totalPaginas={data.totalPaginas} />
    </>
  );
}

export default function Noticias() {
  const [params] = useSearchParams();
  const pagina = Math.max(1, Number(params.get("pagina")) || 1);
  return (
    <PaginaSecciones
      slug="noticias"
      tituloRespaldo="Noticias"
      tituloDocumento={pagina > 1 ? `Noticias, página ${pagina}` : "Noticias"}
    >
      <div className="container seccion">
        <Listado pagina={pagina} />
      </div>
    </PaginaSecciones>
  );
}
