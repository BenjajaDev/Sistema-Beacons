import type { CSSProperties, ReactNode, Ref } from "react";
import { Link } from "react-router";
import { BotonVoz } from "@shared/voz/BotonVoz";
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
  style,
}: {
  imagen: Imagen;
  prioridad?: boolean;
  className?: string;
  style?: CSSProperties;
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
      style={style}
    />
  );
}

// Botón para escuchar el texto alternativo de una imagen con la voz del
// dispositivo. Va dentro de un contenedor .con-voz (posición relativa), en la
// esquina de la imagen. Sin texto alternativo (imagen decorativa) no aparece.
export function VozDeImagen({ imagen }: { imagen: Imagen }) {
  return (
    <BotonVoz
      texto={imagen.alt}
      etiqueta="Escuchar la descripción de la imagen"
      className="con-voz__boton"
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

// El logo es un enlace al inicio. Si se subieron logos en Identidad visual, el CSS
// muestra el del tema activo; si no, el isotipo vectorial. Las imágenes son
// decorativas porque el enlace ya tiene nombre.
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
        <span className="logo__marca">
          <Isotipo />
        </span>
      )}
    </Link>
  );
}

// El isotipo de SIGNAL: el beacon con su luz, las ondas de la señal y el teléfono
// que la convierte en voz. Sin fondo y con los colores del tema (variables CSS),
// así que el mismo dibujo sirve en claro y en oscuro.
const BARRAS_DE_VOZ = [10, 22, 34, 26, 16, 8];
function arcoDeOnda(r: number) {
  const a = (40 * Math.PI) / 180;
  const x = (66 + r * Math.cos(a)).toFixed(1);
  return `M${x} ${(54 - r * Math.sin(a)).toFixed(1)}A${r} ${r} 0 0 1 ${x} ${(54 + r * Math.sin(a)).toFixed(1)}`;
}
export function Isotipo({ className = "isotipo" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 150 96" aria-hidden="true" focusable="false">
      <path
        className="isotipo__beacon"
        d="M18 30 34 22 50 26 60 44 58 72 46 86 24 86 10 72 8 46Z"
      />
      <path className="isotipo__facetas" d="M30 50 8 46M30 50 60 44M30 50 46 86" />
      <circle className="isotipo__brillo" cx="42" cy="38" r="8" />
      <circle className="isotipo__luz" cx="42" cy="38" r="4" />
      {[9, 17, 25].map((r, i) => (
        <path key={r} className={`isotipo__onda isotipo__onda--${i + 1}`} d={arcoDeOnda(r)} />
      ))}
      <rect className="isotipo__telefono" x="100" y="8" width="42" height="80" rx="9" />
      <path className="isotipo__telefono" d="M114 15h14" />
      {BARRAS_DE_VOZ.map((alto, i) => (
        <path key={i} className="isotipo__voz" d={`M${108 + i * 5} ${50 - alto / 2}v${alto}`} />
      ))}
    </svg>
  );
}
