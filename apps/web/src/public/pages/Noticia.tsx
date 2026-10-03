import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ApiError, mensajeDeError } from "@shared/api";
import { Cargando, ErrorState, Skeleton } from "@shared/ui/States";
import { Fecha, Img } from "../components";
import { consultas, useTituloPagina } from "../data";
import NoEncontrada from "./NoEncontrada";

export default function Noticia() {
  const { slug = "" } = useParams();
  const { data, isPending, error, refetch } = useQuery(consultas.noticia(slug));
  const refH1 = useTituloPagina(data?.news.title ?? "Noticia");

  if (error instanceof ApiError && error.status === 404) return <NoEncontrada />;

  return (
    <article className="container seccion noticia">
      <p>
        <Link to="/noticias">
          <span aria-hidden="true">←</span> Todas las noticias
        </Link>
      </p>
      {isPending ? (
        <>
          <h1 ref={refH1} tabIndex={-1} className="visually-hidden">
            Cargando la noticia
          </h1>
          <Cargando etiqueta="Cargando la noticia…">
            <Skeleton alto="3rem" ancho="80%" />
            <Skeleton alto="18rem" style={{ marginTop: "1.5rem" }} />
          </Cargando>
        </>
      ) : error ? (
        <>
          <h1 ref={refH1} tabIndex={-1}>
            Noticia
          </h1>
          <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
        </>
      ) : (
        <>
          <header className="noticia__cabecera prosa">
            {data.news.category && <p className="noticia__categoria">{data.news.category}</p>}
            <h1 ref={refH1} tabIndex={-1}>
              {data.news.title}
            </h1>
            <p className="noticia__bajada">{data.news.excerpt}</p>
            <p className="noticia__meta">
              <Fecha iso={data.news.publishedAt} /> · {data.news.author}
              {data.news.lectura && <> · {data.news.lectura.minutosLectura} min de lectura</>}
            </p>
          </header>
          {data.news.cover && (
            <figure className="noticia__portada">
              <Img imagen={data.news.cover} prioridad />
            </figure>
          )}
          {/* HTML generado y saneado por el servidor (server/src/content/rich-text.ts). */}
          <div className="prosa" dangerouslySetInnerHTML={{ __html: data.news.bodyHtml }} />
        </>
      )}
    </article>
  );
}
