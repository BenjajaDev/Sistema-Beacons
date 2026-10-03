import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { mensajeDeError } from "@shared/api";
import { Cargando, ErrorState, Skeleton } from "@shared/ui/States";
// Mismos componentes y estilos que la landing: la vista previa es fiel a lo publicado.
// (El panel puede importar de la landing; al revés está prohibido.)
import { Fecha, Img } from "../../public/components";
import type { NoticiaDetalle } from "../../public/data";
import "../../public/landing.css";
import type { EstadoNoticia } from "../api";
import { adminFetch } from "../api";
import { Estado, usePanelPage } from "../ui";

export default function NoticiaPreview() {
  const { id = "" } = useParams();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin", "noticia", id, "vista-previa"],
    queryFn: () =>
      adminFetch<{ news: NoticiaDetalle; status: EstadoNoticia }>(`/news/${id}/preview`),
  });
  const h1 = usePanelPage(data ? `Vista previa: ${data.news.title}` : "Vista previa");

  return (
    <div className="vista-previa">
      <div className="aviso-panel aviso-panel--info vista-previa__barra">
        <p>
          <strong>Vista previa.</strong> Así se verá la nota en el sitio.{" "}
          {data && (
            <>
              Estado actual: <Estado estado={data.status} />
            </>
          )}
        </p>
        <Link to={`/noticias/${id}`} className="btn btn--secundario">
          Volver a editar
        </Link>
      </div>
      <article className="container seccion noticia">
        {isPending ? (
          <>
            <h1 ref={h1} tabIndex={-1} className="visually-hidden">
              Cargando la vista previa
            </h1>
            <Cargando>
              <Skeleton alto="3rem" ancho="80%" />
              <Skeleton alto="16rem" style={{ marginTop: "1rem" }} />
            </Cargando>
          </>
        ) : error ? (
          <>
            <h1 ref={h1} tabIndex={-1}>
              Vista previa
            </h1>
            <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
          </>
        ) : (
          <>
            <header className="noticia__cabecera prosa">
              {data.news.category && <p className="noticia__categoria">{data.news.category}</p>}
              <h1 ref={h1} tabIndex={-1}>
                {data.news.title}
              </h1>
              <p className="noticia__bajada">{data.news.excerpt}</p>
              <p className="noticia__meta">
                {data.news.publishedAt ? <Fecha iso={data.news.publishedAt} /> : "Sin publicar"} ·{" "}
                {data.news.author}
                {data.news.lectura && <> · {data.news.lectura.minutosLectura} min de lectura</>}
              </p>
            </header>
            {data.news.cover && (
              <figure className="noticia__portada">
                <Img imagen={data.news.cover} prioridad />
              </figure>
            )}
            {/* HTML generado y saneado por el servidor. */}
            <div className="prosa" dangerouslySetInnerHTML={{ __html: data.news.bodyHtml }} />
          </>
        )}
      </article>
    </div>
  );
}
