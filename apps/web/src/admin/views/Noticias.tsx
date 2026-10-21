import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { TextField } from "@shared/ui/Field";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { adminFetch, type EstadoNoticia, type Noticia } from "../api";
import { Cabecera, Estado, formatoFecha, usePanelPage, RegionDesplazable } from "../ui";

const FILTROS: { valor: EstadoNoticia | ""; texto: string }[] = [
  { valor: "", texto: "Todas" },
  { valor: "DRAFT", texto: "Borradores" },
  { valor: "REVIEW", texto: "En revisión" },
  { valor: "PUBLISHED", texto: "Publicadas" },
];

export default function Noticias() {
  const h1 = usePanelPage("Noticias");
  const [params, setParams] = useSearchParams();
  const estado = (params.get("estado") ?? "") as EstadoNoticia | "";
  const mias = params.get("mias") === "1";
  const [busqueda, setBusqueda] = useState(params.get("q") ?? "");
  const q = params.get("q") ?? "";

  const consulta = useInfiniteQuery({
    queryKey: ["admin", "noticias", { estado, mias, q }],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ limit: "20" });
      if (estado) p.set("status", estado);
      if (mias) p.set("mias", "true");
      if (q) p.set("q", q);
      if (pageParam) p.set("cursor", pageParam);
      return adminFetch<{
        items: Noticia[];
        nextCursor: string | null;
        porEstado: Record<string, number>;
      }>(`/news?${p}`);
    },
    getNextPageParam: (ultima) => ultima.nextCursor,
  });

  const cambiar = (clave: string, valor: string | null) => {
    const p = new URLSearchParams(params);
    if (valor) p.set(clave, valor);
    else p.delete(clave);
    setParams(p, { replace: true });
  };

  const items = consulta.data?.pages.flatMap((p) => p.items) ?? [];
  const porEstado = consulta.data?.pages[0]?.porEstado ?? {};

  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Noticias"
        descripcion="Escribe notas, envíalas a revisión y sigue su estado."
        acciones={
          <Link to="/noticias/nueva" className="btn btn--primario">
            Nueva noticia
          </Link>
        }
      />

      <nav aria-label="Filtrar por estado" className="filtros">
        <ul>
          {FILTROS.map((f) => (
            <li key={f.valor || "todas"}>
              <Link
                to={`?${new URLSearchParams({ ...(f.valor && { estado: f.valor }), ...(mias && { mias: "1" }), ...(q && { q }) })}`}
                aria-current={estado === f.valor ? "page" : undefined}
                replace
              >
                {f.texto}
                {f.valor && porEstado[f.valor] !== undefined && (
                  <span className="contador">{porEstado[f.valor]}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form
        role="search"
        className="busqueda"
        onSubmit={(e) => {
          e.preventDefault();
          cambiar("q", busqueda.trim() || null);
        }}
      >
        <TextField
          label="Buscar por título"
          opcional
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Button type="submit" variante="secundario">
          Buscar
        </Button>
        <label className="casilla">
          <input
            type="checkbox"
            checked={mias}
            onChange={(e) => cambiar("mias", e.target.checked ? "1" : null)}
          />
          Solo las mías
        </label>
      </form>

      {consulta.isPending ? (
        <Cargando etiqueta="Cargando noticias…">
          <Skeleton alto="12rem" />
        </Cargando>
      ) : consulta.error ? (
        <ErrorState
          mensaje={mensajeDeError(consulta.error)}
          onReintentar={() => consulta.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          titulo={q || estado || mias ? "No hay noticias con estos filtros" : "Aún no hay noticias"}
          texto={
            q || estado || mias
              ? "Prueba con otros filtros o quítalos."
              : "Crea la primera para empezar a contar las novedades del proyecto."
          }
          accion={
            <Link to="/noticias/nueva" className="btn btn--primario">
              Nueva noticia
            </Link>
          }
        />
      ) : (
        <>
          <RegionDesplazable etiqueta="Lista de noticias">
            <table className="tabla">
              <caption className="visually-hidden">
                Noticias{estado ? `, filtradas por estado` : ""}. {items.length} mostradas.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Título</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Autoría</th>
                  <th scope="col">Última edición</th>
                </tr>
              </thead>
              <tbody>
                {items.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <Link to={`/noticias/${n.id}`}>{n.title}</Link>
                      {n.reviewNote && n.status === "DRAFT" && (
                        <span className="texto-aviso"> · devuelta con observaciones</span>
                      )}
                    </td>
                    <td>
                      <Estado estado={n.status} />
                    </td>
                    <td>{n.author.name}</td>
                    <td>{formatoFecha(n.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RegionDesplazable>
          {consulta.hasNextPage && (
            <Button
              variante="secundario"
              cargando={consulta.isFetchingNextPage}
              textoCargando="Cargando más…"
              onClick={() => consulta.fetchNextPage()}
            >
              Cargar más noticias
            </Button>
          )}
        </>
      )}
    </div>
  );
}
