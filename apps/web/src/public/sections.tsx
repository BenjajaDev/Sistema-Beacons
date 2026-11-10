import { useQuery } from "@tanstack/react-query";
import { useId, type ComponentType, type ReactNode, type Ref } from "react";
import { Link } from "react-router";
import { mensajeDeError } from "@shared/api";
import { Cargando, EmptyState, ErrorState, Reveal, Skeleton } from "@shared/ui/States";
import { BotonVoz } from "@shared/voz/BotonVoz";
import { EnlaceEditable, Img, TarjetaNoticia, Titulo, VozDeImagen, type Nivel } from "./components";
import {
  consultas,
  NOTICIAS_EN_INICIO,
  useTituloPagina,
  type Imagen,
  type Seccion,
  type SlugPagina,
} from "./data";
import { EquipoFila } from "./EquipoFila";
import { EquipoTarjetas } from "./EquipoTarjetas";

// --- Tipos del contenido de cada sección (ver server/src/content/sections.ts) ---

interface Enlace {
  texto: string;
  href: string;
}
interface Item {
  titulo: string;
  texto: string;
  imagen?: Imagen;
}
interface Encabezado {
  titulo: string;
  intro?: string;
  imagen?: Imagen;
  audiodescripcion?: string;
}

interface PropsSeccion<C> {
  contenido: C;
  nivel: Nivel;
  refH1?: Ref<HTMLHeadingElement>;
  idTitulo: string;
}

function Accion({ enlace, variante }: { enlace: Enlace; variante: "primario" | "secundario" }) {
  return (
    <EnlaceEditable href={enlace.href} className={`btn btn--${variante}`}>
      {enlace.texto}
    </EnlaceEditable>
  );
}

// Imagen de una sección. Si es la del primer bloque de la página (nivel 1) se
// carga con prioridad: suele ser lo más grande de la primera pantalla (LCP).
function ImagenSeccion({
  imagen,
  nivel,
  className,
}: {
  imagen: Imagen;
  nivel: Nivel;
  className: string;
}) {
  return (
    <figure className={`${className} con-voz`}>
      <Img imagen={imagen} prioridad={nivel === 1} />
      <VozDeImagen imagen={imagen} />
    </figure>
  );
}

// «Escuchar esta sección»: lee la audiodescripción que se escribe en el panel.
// Va después del título; sin texto no aparece.
function AudioSeccion({ texto }: { texto?: string }) {
  return (
    <BotonVoz
      texto={texto ?? ""}
      etiqueta="Escuchar esta sección"
      variante="texto"
      className="audio-seccion"
    />
  );
}

// Imagen de un paso o una tarjeta, con su botón de voz en la esquina.
function ImagenDeItem({ imagen }: { imagen: Imagen }) {
  return (
    <div className="con-voz">
      <Img imagen={imagen} className="item__imagen" />
      <VozDeImagen imagen={imagen} />
    </div>
  );
}

function Cabecera({ contenido, nivel, refH1, idTitulo }: PropsSeccion<Encabezado>) {
  return (
    <div className="seccion__cabecera">
      <Titulo nivel={nivel} refH1={refH1} id={idTitulo}>
        {contenido.titulo}
      </Titulo>
      <AudioSeccion texto={contenido.audiodescripcion} />
      {contenido.intro && <p className="seccion__intro">{contenido.intro}</p>}
      {contenido.imagen && (
        <ImagenSeccion imagen={contenido.imagen} nivel={nivel} className="seccion__imagen" />
      )}
    </div>
  );
}

// --- Renderizadores ------------------------------------------------------------

function Hero(
  p: PropsSeccion<{
    antetitulo?: string;
    titulo: string;
    bajada: string;
    imagen?: Imagen;
    accionPrincipal?: Enlace;
    accionSecundaria?: Enlace;
    audiodescripcion?: string;
  }>,
) {
  const c = p.contenido;
  const hayAcciones = c.accionPrincipal || c.accionSecundaria;
  return (
    <div className="hero">
      <div className="hero__texto">
        {c.antetitulo && <p className="hero__antetitulo">{c.antetitulo}</p>}
        <Titulo nivel={p.nivel} refH1={p.refH1} id={p.idTitulo} className="hero__titulo">
          {c.titulo}
        </Titulo>
        <AudioSeccion texto={c.audiodescripcion} />
        <p className="hero__bajada">{c.bajada}</p>
        {hayAcciones && (
          <div className="hero__acciones">
            {c.accionPrincipal && <Accion enlace={c.accionPrincipal} variante="primario" />}
            {c.accionSecundaria && (
              <Accion
                enlace={c.accionSecundaria}
                variante={c.accionPrincipal ? "secundario" : "primario"}
              />
            )}
          </div>
        )}
      </div>
      {c.imagen ? (
        <ImagenSeccion imagen={c.imagen} nivel={p.nivel} className="hero__imagen" />
      ) : (
        <SenalHero />
      )}
    </div>
  );
}

// Ilustración del hero: un beacon que emite ondas hacia la persona. Decorativa.
// Las ondas aparecen una sola vez al cargar (sin bucle) y nada se mueve con
// «reducir movimiento».
function SenalHero() {
  return (
    <svg className="hero__senal" viewBox="0 0 320 320" aria-hidden="true" focusable="false">
      <circle className="hero__onda hero__onda--4" cx="96" cy="160" r="150" />
      <circle className="hero__onda hero__onda--3" cx="96" cy="160" r="112" />
      <circle className="hero__onda hero__onda--2" cx="96" cy="160" r="76" />
      <circle className="hero__onda hero__onda--1" cx="96" cy="160" r="42" />
      <path
        className="hero__beacon"
        d="M80 126 L110 130 L124 156 L122 194 L104 214 L76 212 L60 192 L62 150 Z"
      />
      <circle className="hero__luz" cx="104" cy="148" r="7" />
    </svg>
  );
}

// Columnas en pantallas anchas: hasta 3 en una fila; 4 pasos van de a 2.
const columnasDePasos = (n: number) => (n <= 3 ? n : n === 4 ? 2 : 3);

function Pasos(p: PropsSeccion<Encabezado & { pasos: Item[] }>) {
  return (
    <>
      <Cabecera {...p} />
      <ol className="pasos" data-columnas={columnasDePasos(p.contenido.pasos.length)}>
        {p.contenido.pasos.map((paso, i) => (
          <li key={i} className="pasos__item">
            {paso.imagen && <ImagenDeItem imagen={paso.imagen} />}
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
            {item.imagen && <ImagenDeItem imagen={item.imagen} />}
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

function QuienesSomos(
  p: PropsSeccion<{
    titulo: string;
    cuerpo: { html: string };
    imagen?: Imagen;
    audiodescripcion?: string;
  }>,
) {
  const { imagen } = p.contenido;
  return (
    <div className={imagen ? "dos-columnas" : undefined}>
      <div>
        <Titulo nivel={p.nivel} refH1={p.refH1} id={p.idTitulo}>
          {p.contenido.titulo}
        </Titulo>
        <AudioSeccion texto={p.contenido.audiodescripcion} />
        {/* HTML generado y saneado por el servidor (server/src/content/rich-text.ts). */}
        <div className="prosa" dangerouslySetInnerHTML={{ __html: p.contenido.cuerpo.html }} />
      </div>
      {imagen && <ImagenSeccion imagen={imagen} nivel={p.nivel} className="bloque__imagen" />}
    </div>
  );
}

// Bloque de imagen y texto. Los párrafos se separan con una línea en blanco.
function ImagenTexto(
  p: PropsSeccion<{
    titulo: string;
    texto: string;
    imagen?: Imagen;
    posicion: "izquierda" | "derecha";
    accion?: Enlace;
  }>,
) {
  const c = p.contenido;
  const parrafos = c.texto
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  return (
    <div
      className={c.imagen ? "dos-columnas" : undefined}
      data-imagen={c.imagen ? c.posicion : undefined}
    >
      <div className="imagen-texto__texto">
        <Titulo nivel={p.nivel} refH1={p.refH1} id={p.idTitulo}>
          {c.titulo}
        </Titulo>
        {parrafos.map((t, i) => (
          <p key={i} className="seccion__intro">
            {t}
          </p>
        ))}
        {c.accion && <Accion enlace={c.accion} variante="primario" />}
      </div>
      {c.imagen && <ImagenSeccion imagen={c.imagen} nivel={p.nivel} className="bloque__imagen" />}
    </div>
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
        <EquipoTarjetas personas={data.items} />
      )}
    </>
  );
}

// Presenta al equipo en el inicio: texto, botón opcional, una imagen opcional al
// lado y debajo la fila del equipo con sus cards (los datos llegan con el HTML inicial).
function NosotrosInicio(
  p: PropsSeccion<{
    titulo: string;
    texto: string;
    imagen?: Imagen;
    accion?: Enlace;
    audiodescripcion?: string;
  }>,
) {
  const { data } = useQuery(consultas.equipo());
  const { imagen } = p.contenido;
  const personas = data?.items ?? [];
  return (
    <>
      <div className={imagen ? "nosotros-inicio dos-columnas" : "nosotros-inicio"}>
        <div className="nosotros-inicio__texto">
          <Titulo nivel={p.nivel} refH1={p.refH1} id={p.idTitulo}>
            {p.contenido.titulo}
          </Titulo>
          <AudioSeccion texto={p.contenido.audiodescripcion} />
          <p className="seccion__intro">{p.contenido.texto}</p>
          {p.contenido.accion && <Accion enlace={p.contenido.accion} variante="primario" />}
        </div>
        {imagen && <ImagenSeccion imagen={imagen} nivel={p.nivel} className="bloque__imagen" />}
      </div>
      {personas.length > 0 && <EquipoFila personas={personas} />}
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
      ) : data.items.length === 0 ? (
        <EmptyState titulo="Pronto presentaremos a quienes colaboran con SIGNAL" />
      ) : (
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
  "nosotros-inicio": NosotrosInicio as ComponentType<PropsSeccion<never>>,
  "noticias-recientes": NoticiasRecientes as ComponentType<PropsSeccion<never>>,
  "quienes-somos": QuienesSomos as ComponentType<PropsSeccion<never>>,
  equipo: Equipo as ComponentType<PropsSeccion<never>>,
  colaboradores: Colaboradores as ComponentType<PropsSeccion<never>>,
  noticias: Cabecera as ComponentType<PropsSeccion<never>>,
  contacto: Cabecera as ComponentType<PropsSeccion<never>>,
  "imagen-texto-inicio": ImagenTexto as ComponentType<PropsSeccion<never>>,
  "imagen-texto-nosotros": ImagenTexto as ComponentType<PropsSeccion<never>>,
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
