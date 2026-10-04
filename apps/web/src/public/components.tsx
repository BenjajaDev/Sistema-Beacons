import type { ReactNode, Ref } from "react";
import { Link } from "react-router";
import type { Imagen, NoticiaResumen, RedSocial, Sitio } from "./data";
import { detectarRed, IconoRed } from "./IconosRedes";

// --- Títulos ----------------------------------------------------------------

// Cada página tiene un solo <h1>: el título de su primera sección. Las demás
// secciones usan <h2> y sus elementos internos <h3>. El <h1> recibe el foco al
// navegar (tabIndex -1) para que el lector anuncie la página nueva.
export type Nivel = 1 | 2;

export function Titulo({
  nivel,
  refH1,
  className,
  id,
  children,
}: {
  nivel: Nivel;
  refH1?: Ref<HTMLHeadingElement>;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  if (nivel === 1) {
    return (
      <h1 ref={refH1} tabIndex={-1} className={className} id={id}>
        {children}
      </h1>
    );
  }
  return (
    <h2 className={className} id={id}>
      {children}
    </h2>
  );
}

// --- Enlaces editables ----------------------------------------------------------

// Destinos que se editan en el panel: rutas internas con el router; anclas y
// enlaces externos con <a> (los https se abren con rel seguro).
export function EnlaceEditable({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (href.startsWith("/")) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className={className}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

// --- Fecha ------------------------------------------------------------------

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CL", { dateStyle: "long" });

export function Fecha({ iso }: { iso: string }) {
  return <time dateTime={iso}>{FORMATO_FECHA.format(new Date(iso))}</time>;
}

// --- Imágenes ---------------------------------------------------------------

// width/height evitan saltos de diseño mientras carga (CLS).
export function Img({
  imagen,
  prioridad = false,
  className,
}: {
  imagen: Imagen;
  prioridad?: boolean;
  className?: string;
}) {
  return (
    <img
      src={imagen.url}
      alt={imagen.alt}
      width={imagen.width ?? undefined}
      height={imagen.height ?? undefined}
      loading={prioridad ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={prioridad ? "high" : undefined}
      className={className}
    />
  );
}

// --- Noticias ---------------------------------------------------------------

// Tarjeta con un solo enlace (el título): el lector no repite tres enlaces a la
// misma nota, y toda la tarjeta es clicable con CSS.
export function TarjetaNoticia({ noticia, nivel = 3 }: { noticia: NoticiaResumen; nivel?: 2 | 3 }) {
  const H = nivel === 2 ? "h2" : "h3";
  return (
    <article className="tarjeta-noticia">
      {noticia.cover && <Img imagen={noticia.cover} className="tarjeta-noticia__imagen" />}
      <div className="tarjeta-noticia__cuerpo">
        <p className="tarjeta-noticia__meta">
          {noticia.category && <span>{noticia.category}</span>} <Fecha iso={noticia.publishedAt} />
        </p>
        <H className="tarjeta-noticia__titulo">
          <Link to={`/noticias/${noticia.slug}`} className="tarjeta-noticia__enlace">
            {noticia.title}
          </Link>
        </H>
        <p className="tarjeta-noticia__bajada">{noticia.excerpt}</p>
      </div>
    </article>
  );
}

export function Paginacion({ pagina, totalPaginas }: { pagina: number; totalPaginas: number }) {
  if (totalPaginas <= 1) return null;
  const url = (n: number) => (n === 1 ? "/noticias" : `/noticias?pagina=${n}`);
  return (
    <nav aria-label="Paginación de noticias" className="paginacion">
      <ul>
        {pagina > 1 && (
          <li>
            <Link to={url(pagina - 1)} rel="prev">
              <span aria-hidden="true">←</span> Anteriores
            </Link>
          </li>
        )}
        {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
          <li key={n}>
            <Link
              to={url(n)}
              aria-current={n === pagina ? "page" : undefined}
              aria-label={`Página ${n}`}
            >
              {n}
            </Link>
          </li>
        ))}
        {pagina < totalPaginas && (
          <li>
            <Link to={url(pagina + 1)} rel="next">
              Siguientes <span aria-hidden="true">→</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

// --- Redes y logo -------------------------------------------------------------

// Enlaces a redes con el ícono de cada una. «iconos»: botones redondos con el
// nombre solo para lectores (pie); «chips»: ícono y nombre visibles.
export function Redes({
  redes,
  etiqueta,
  variante = "chips",
}: {
  redes: RedSocial[];
  etiqueta: string;
  variante?: "iconos" | "chips";
}) {
  if (!redes.length) return null;
  return (
    <ul className={`redes redes--${variante}`} aria-label={etiqueta}>
      {redes.map((r) => {
        const nombre = r.etiqueta || r.red;
        return (
          <li key={r.url}>
            <a href={r.url} rel="noopener noreferrer" className="red">
              <IconoRed red={detectarRed(r.red, r.url)} className="red__icono" />
              {variante === "iconos" ? (
                <span className="visually-hidden">{nombre}</span>
              ) : (
                <span className="red__nombre">{nombre}</span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// El logo es un enlace al inicio. Si hay logos claro y oscuro, el CSS muestra el
// del tema activo; la imagen es decorativa porque el enlace ya tiene nombre.
export function Logo({ sitio }: { sitio: Sitio | undefined }) {
  const nombre = sitio?.siteName ?? "SIGNAL";
  const { claro, oscuro } = sitio?.logos ?? { claro: null, oscuro: null };
  return (
    <Link to="/" className="logo" aria-label={`${nombre}, ir al inicio`}>
      {claro ? (
        <>
          <img
            src={claro.url}
            alt=""
            className={oscuro ? "logo__img logo__img--claro" : "logo__img"}
          />
          {oscuro && <img src={oscuro.url} alt="" className="logo__img logo__img--oscuro" />}
        </>
      ) : (
        <span className="logo__texto">{nombre}</span>
      )}
    </Link>
  );
}
