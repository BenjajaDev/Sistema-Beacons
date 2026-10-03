import { useQuery } from "@tanstack/react-query";
import { useId, type ComponentType, type ReactNode, type Ref } from "react";
import { Link } from "react-router";
import { mensajeDeError } from "@shared/api";
import { Cargando, EmptyState, ErrorState, Reveal, Skeleton } from "@shared/ui/States";
import { Img, TarjetaNoticia, Titulo, type Nivel } from "./components";
import {
  consultas,
  NOTICIAS_EN_INICIO,
  useTituloPagina,
  type Seccion,
  type SlugPagina,
} from "./data";

// --- Tipos del contenido de cada sección (ver server/src/content/sections.ts) ---

interface Enlace {
  texto: string;
  href: string;
}
interface Item {
  titulo: string;
  texto: string;
}
interface Encabezado {
  titulo: string;
  intro?: string;
}

interface PropsSeccion<C> {
  contenido: C;
  nivel: Nivel;
  refH1?: Ref<HTMLHeadingElement>;
  idTitulo: string;
}

// Rutas internas con el router; anclas y enlaces externos con <a>.
function Accion({ enlace, variante }: { enlace: Enlace; variante: "primario" | "secundario" }) {
  const clase = `btn btn--${variante}`;
  if (enlace.href.startsWith("/")) {
    return (
      <Link to={enlace.href} className={clase}>
        {enlace.texto}
      </Link>
    );
  }
  return (
    <a
      href={enlace.href}
      className={clase}
      rel={enlace.href.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {enlace.texto}
    </a>
  );
}

function Cabecera({ contenido, nivel, refH1, idTitulo }: PropsSeccion<Encabezado>) {
  return (
    <div className="seccion__cabecera">
      <Titulo nivel={nivel} refH1={refH1} id={idTitulo}>
        {contenido.titulo}
      </Titulo>
      {contenido.intro && <p className="seccion__intro">{contenido.intro}</p>}
    </div>
  );
}

// --- Renderizadores ------------------------------------------------------------

function Hero(
  p: PropsSeccion<{
    antetitulo?: string;
    titulo: string;
    bajada: string;
    accionPrincipal: Enlace;
    accionSecundaria?: Enlace;
  }>,
) {
  const c = p.contenido;
  return (
    <div className="hero">
      {c.antetitulo && <p className="hero__antetitulo">{c.antetitulo}</p>}
      <Titulo nivel={p.nivel} refH1={p.refH1} id={p.idTitulo} className="hero__titulo">
        {c.titulo}
      </Titulo>
      <p className="hero__bajada">{c.bajada}</p>
      <div className="hero__acciones">
        <Accion enlace={c.accionPrincipal} variante="primario" />
        {c.accionSecundaria && <Accion enlace={c.accionSecundaria} variante="secundario" />}
      </div>
    </div>
  );
}

function Pasos(p: PropsSeccion<Encabezado & { pasos: Item[] }>) {
  return (
    <>
      <Cabecera {...p} />
      <ol className="pasos">
        {p.contenido.pasos.map((paso, i) => (
          <li key={i} className="pasos__item">
            <span className="pasos__numero" aria-hidden="true">
              {i + 1}
            </span>
            <h3>{paso.titulo}</h3>
            <p>{paso.texto}</p>
          </li>
        ))}
      </ol>
    </>
  );
}

function Tarjetas(p: PropsSeccion<Encabezado & { items: Item[] }>) {
  return (
    <>
      <Cabecera {...p} />
      <ul className="tarjetas">
        {p.contenido.items.map((item, i) => (
          <li key={i} className="tarjeta">
            <h3>{item.titulo}</h3>
            <p>{item.texto}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

function NoticiasRecientes(p: PropsSeccion<Encabezado & { textoVerTodas: string }>) {
  const { data, isPending, error, refetch } = useQuery(
    consultas.noticias({ pagina: 1, porPagina: NOTICIAS_EN_INICIO }),
  );
  return (
    <>
      <Cabecera {...p} />
      {isPending ? (
        <Cargando etiqueta="Cargando noticias…">
          <Skeleton alto="10rem" />
        </Cargando>
      ) : error ? (
        <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          titulo="Todavía no hay noticias publicadas"
          texto="Vuelve pronto para conocer las novedades del proyecto."
        />
      ) : (
        <>
          <ul className="rejilla-noticias">
            {data.items.map((n) => (
              <li key={n.slug}>
                <TarjetaNoticia noticia={n} />
              </li>
            ))}
          </ul>
          <p>
            <Link to="/noticias" className="btn btn--secundario">
              {p.contenido.textoVerTodas}
            </Link>
          </p>
        </>
      )}
    </>
  );
}

function QuienesSomos(p: PropsSeccion<{ titulo: string; cuerpo: { html: string } }>) {
  return (
    <>
      <Titulo nivel={p.nivel} refH1={p.refH1} id={p.idTitulo}>
        {p.contenido.titulo}
      </Titulo>
      {/* HTML generado y saneado por el servidor (server/src/content/rich-text.ts). */}
      <div className="prosa" dangerouslySetInnerHTML={{ __html: p.contenido.cuerpo.html }} />
    </>
  );
}

function Equipo(p: PropsSeccion<Encabezado>) {
  const { data, isPending, error, refetch } = useQuery(consultas.equipo());
  return (
    <>
      <Cabecera {...p} />
      {isPending ? (
        <Cargando etiqueta="Cargando equipo…">
          <Skeleton alto="8rem" />
        </Cargando>
      ) : error ? (
        <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState titulo="Pronto presentaremos al equipo" />
      ) : (
        <ul className="personas">
          {data.items.map((m) => (
            <li key={m.name} className="persona">
              {m.photo && <Img imagen={m.photo} className="persona__foto" />}
              <h3 className="persona__nombre">{m.name}</h3>
              <p className="persona__cargo">{m.position}</p>
              {m.bio && <p>{m.bio}</p>}
              {m.links.length > 0 && (
                <ul className="redes" aria-label={`Enlaces de ${m.name}`}>
                  {m.links.map((l) => (
                    <li key={l.url}>
                      <a href={l.url} rel="noopener noreferrer">
                        {l.etiqueta || l.red}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Colaboradores(p: PropsSeccion<Encabezado>) {
  const { data, isPending, error, refetch } = useQuery(consultas.colaboradores());
  return (
    <>
      <Cabecera {...p} />
      {isPending ? (
        <Cargando etiqueta="Cargando colaboradores…">
          <Skeleton alto="6rem" />
        </Cargando>
      ) : error ? (
        <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : data.items.length === 0 ? null : (
        <ul className="colaboradores">
          {data.items.map((c) => {
            const contenido = (
              <>
                {c.logo ? (
                  <Img imagen={c.logo} className="colaborador__logo" />
                ) : (
                  <span className="colaborador__nombre">{c.name}</span>
                )}
                {c.description && <span className="colaborador__desc">{c.description}</span>}
              </>
            );
            return (
              <li key={c.name} className="colaborador">
                {c.url ? (
                  <a href={c.url} rel="noopener noreferrer">
                    {contenido}
                  </a>
                ) : (
                  contenido
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export const RENDERIZADORES: Record<string, ComponentType<PropsSeccion<never>>> = {
  hero: Hero as ComponentType<PropsSeccion<never>>,
  "que-es": Pasos as ComponentType<PropsSeccion<never>>,
  objetivos: Tarjetas as ComponentType<PropsSeccion<never>>,
  proyecciones: Tarjetas as ComponentType<PropsSeccion<never>>,
  "noticias-recientes": NoticiasRecientes as ComponentType<PropsSeccion<never>>,
  "quienes-somos": QuienesSomos as ComponentType<PropsSeccion<never>>,
  equipo: Equipo as ComponentType<PropsSeccion<never>>,
  colaboradores: Colaboradores as ComponentType<PropsSeccion<never>>,
  noticias: Cabecera as ComponentType<PropsSeccion<never>>,
  contacto: Cabecera as ComponentType<PropsSeccion<never>>,
};

function BloqueSeccion({
  seccion,
  nivel,
  refH1,
}: {
  seccion: Seccion;
  nivel: Nivel;
  refH1?: Ref<HTMLHeadingElement>;
}) {
  const idTitulo = useId();
  const Componente = RENDERIZADORES[seccion.key];
  if (!Componente) return null;
  const cuerpo = (
    <div className="container">
      <Componente
        contenido={seccion.content as never}
        nivel={nivel}
        refH1={refH1}
        idTitulo={idTitulo}
      />
    </div>
  );
  return (
    <section
      id={seccion.key}
      aria-labelledby={idTitulo}
      className={`seccion seccion--${seccion.key}`}
    >
      {/* La primera sección se pinta sin animación: es el contenido principal (LCP). */}
      {nivel === 1 ? cuerpo : <Reveal>{cuerpo}</Reveal>}
    </section>
  );
}

// Página armada con sus secciones visibles, en el orden del panel. Si no hay
// ninguna, muestra el título de respaldo para que la página siga teniendo un <h1>.
export function PaginaSecciones({
  slug,
  tituloRespaldo,
  tituloDocumento,
  children,
}: {
  slug: SlugPagina;
  tituloRespaldo: string;
  // Título del documento; null en Inicio (nombre del sitio y su lema).
  tituloDocumento?: string | null;
  // Contenido extra de la página (listado de noticias, formulario), después de las secciones.
  children?: ReactNode;
}) {
  const refH1 = useTituloPagina(tituloDocumento === undefined ? tituloRespaldo : tituloDocumento);
  const { data, isPending, error, refetch } = useQuery(consultas.pagina(slug));
  const secciones = (data?.secciones ?? []).filter((s) => RENDERIZADORES[s.key]);

  if (isPending || error || secciones.length === 0) {
    return (
      <>
        <div className="container seccion">
          <h1 ref={refH1} tabIndex={-1}>
            {tituloRespaldo}
          </h1>
          {isPending && (
            <Cargando>
              <Skeleton alto="2rem" ancho="60%" />
              <Skeleton alto="6rem" style={{ marginTop: "1rem" }} />
            </Cargando>
          )}
          {error && <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />}
        </div>
        {!isPending && !error && children}
      </>
    );
  }

  return (
    <>
      {secciones.map((s, i) => (
        <BloqueSeccion
          key={s.key}
          seccion={s}
          nivel={i === 0 ? 1 : 2}
          refH1={i === 0 ? refH1 : undefined}
        />
      ))}
      {children}
    </>
  );
}
