import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { mensajeDeError } from "@shared/api";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { FechaDia, tamanoLegible } from "../components";
import {
  consultas,
  POR_PAGINA_RECURSOS,
  TIPOS_RECURSO,
  type Recurso,
  type TipoRecurso,
} from "../data";
import { PaginaSecciones } from "../sections";

const etiquetaTipo = (clave: TipoRecurso) => TIPOS_RECURSO.find((t) => t.clave === clave)?.etiqueta;

function TarjetaRecurso({ recurso: r }: { recurso: Recurso }) {
  return (
    <article className="tarjeta-recurso">
      <p className="tarjeta-recurso__meta">
        <span>{etiquetaTipo(r.kind)}</span>
        {r.publishedOn && <FechaDia dia={r.publishedOn} />}
      </p>
      <h2 className="tarjeta-recurso__titulo">{r.title}</h2>
      {r.authors && <p className="tarjeta-recurso__autores">{r.authors}</p>}
      {r.description && <p>{r.description}</p>}
      {r.license && <p className="tarjeta-recurso__licencia">Licencia: {r.license}</p>}
      <div className="tarjeta-recurso__acciones">
        {r.file && (
          <a
            href={r.file.url}
            className="btn btn--primario"
            target="_blank"
            rel="noopener noreferrer"
          >
            {"Abrir PDF "}
            <span aria-hidden="true">({tamanoLegible(r.file.sizeBytes)})</span>
            <span className="visually-hidden">
              {` de «${r.title}», ${tamanoLegible(r.file.sizeBytes)}, se abre en una pestaña nueva`}
            </span>
          </a>
        )}
        {r.doiUrl && (
          <a
            href={r.doiUrl}
            className="btn btn--secundario"
            target="_blank"
            rel="noopener noreferrer"
          >
            {`Ver por DOI: ${r.doi} `}
            <span className="visually-hidden">
              {` de «${r.title}» (se abre en una pestaña nueva)`}
            </span>
          </a>
        )}
        {r.externalUrl && (
          <a
            href={r.externalUrl}
            className="btn btn--secundario"
            target="_blank"
            rel="noopener noreferrer"
          >
            {"Ver en el repositorio "}
            <span className="visually-hidden">
              {` de «${r.title}» (se abre en una pestaña nueva)`}
            </span>
          </a>
        )}
      </div>
    </article>
  );
}

function urlRecursos(q: { tipo?: string; q?: string; pagina?: number }) {
  const p = new URLSearchParams();
  if (q.tipo) p.set("tipo", q.tipo);
  if (q.q) p.set("q", q.q);
  if (q.pagina && q.pagina > 1) p.set("pagina", String(q.pagina));
  return p.size ? `/recursos?${p}` : "/recursos";
}

function Listado({ pagina, tipo, texto }: { pagina: number; tipo?: TipoRecurso; texto?: string }) {
  const { data, isPending, error, refetch } = useQuery(
    consultas.recursos({ pagina, porPagina: POR_PAGINA_RECURSOS, tipo, q: texto }),
  );
  if (isPending) {
    return (
      <Cargando etiqueta="Cargando recursos…">
        <div className="rejilla-recursos">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} alto="12rem" />
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
          texto || tipo ? "No encontramos recursos con ese filtro" : "Todavía no hay recursos"
        }
        texto={
          texto || tipo
            ? "Prueba con otra palabra o quita el filtro."
            : "Vuelve pronto: aquí publicaremos informes, artículos y guías."
        }
      />
    );
  }
  return (
    <>
      <ul className="rejilla-recursos">
        {data.items.map((r, i) => (
          <li key={`${i}-${r.title}`}>
            <TarjetaRecurso recurso={r} />
          </li>
        ))}
      </ul>
      {data.totalPaginas > 1 && (
        <nav aria-label="Paginación de recursos" className="paginacion">
          <ul>
            {data.pagina > 1 && (
              <li>
                <Link to={urlRecursos({ tipo, q: texto, pagina: data.pagina - 1 })} rel="prev">
                  <span aria-hidden="true">←</span> Anteriores
                </Link>
              </li>
            )}
            {Array.from({ length: data.totalPaginas }, (_, i) => i + 1).map((n) => (
              <li key={n}>
                <Link
                  to={urlRecursos({ tipo, q: texto, pagina: n })}
                  aria-current={n === data.pagina ? "page" : undefined}
                  aria-label={`Página ${n}`}
                >
                  {n}
                </Link>
              </li>
            ))}
            {data.pagina < data.totalPaginas && (
              <li>
                <Link to={urlRecursos({ tipo, q: texto, pagina: data.pagina + 1 })} rel="next">
                  Siguientes <span aria-hidden="true">→</span>
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </>
  );
}

// Anuncia cuántos recursos hay tras buscar o filtrar. La región existe siempre: una
// región nueva en la página no la leen todos los lectores de pantalla.
function Resultado(p: { pagina: number; tipo?: TipoRecurso; texto?: string }) {
  const { data } = useQuery(
    consultas.recursos({
      pagina: p.pagina,
      porPagina: POR_PAGINA_RECURSOS,
      tipo: p.tipo,
      q: p.texto,
    }),
  );
  return (
    <p role="status" className="recursos__resultado">
      {data ? (data.total === 1 ? "1 recurso" : `${data.total} recursos`) : ""}
    </p>
  );
}

function Buscador({ tipo, texto }: { tipo?: TipoRecurso; texto: string }) {
  const navegar = useNavigate();
  const [valor, setValor] = useState(texto);
  function buscar(e: FormEvent) {
    e.preventDefault();
    navegar(urlRecursos({ tipo, q: valor.trim() }));
  }
  return (
    <form role="search" aria-label="Buscar recursos" className="buscador" onSubmit={buscar}>
      <label htmlFor="buscar-recursos">Buscar por título, autoría o tema</label>
      <div className="buscador__fila">
        <input
          id="buscar-recursos"
          type="search"
          className="campo__control"
          value={valor}
          maxLength={80}
          autoComplete="off"
          onChange={(e) => setValor(e.target.value)}
        />
        <button type="submit" className="btn btn--primario">
          Buscar
        </button>
      </div>
    </form>
  );
}

export default function Recursos() {
  const [params] = useSearchParams();
  const pagina = Math.max(1, Number(params.get("pagina")) || 1);
  const pedido = params.get("tipo") ?? "";
  // Un tipo que no es de la lista se ignora.
  const tipo = TIPOS_RECURSO.find((t) => t.clave === pedido)?.clave;
  const texto = (params.get("q") ?? "").trim().slice(0, 80);
  return (
    <PaginaSecciones
      slug="recursos"
      tituloRespaldo="Recursos"
      tituloDocumento={pagina > 1 ? `Recursos, página ${pagina}` : "Recursos"}
    >
      <div className="container seccion">
        <Buscador key={texto} tipo={tipo} texto={texto} />
        <nav aria-label="Tipos de recurso" className="paginacion filtro-categorias">
          <ul>
            <li>
              <Link to={urlRecursos({ q: texto })} aria-current={tipo ? undefined : "page"}>
                Todos
              </Link>
            </li>
            {TIPOS_RECURSO.map((t) => (
              <li key={t.clave}>
                <Link
                  to={urlRecursos({ tipo: t.clave, q: texto })}
                  aria-current={tipo === t.clave ? "page" : undefined}
                >
                  {t.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Resultado pagina={pagina} tipo={tipo} texto={texto || undefined} />
        <Listado pagina={pagina} tipo={tipo} texto={texto || undefined} />
      </div>
    </PaginaSecciones>
  );
}
