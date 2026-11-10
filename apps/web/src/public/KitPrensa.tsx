import { useQuery } from "@tanstack/react-query";
import { Img, tamanoLegible } from "./components";
import { consultas, POR_PAGINA_RECURSOS } from "./data";

// Kit de prensa: texto listo para citar, contacto y material para descargar. Va al
// final de «Noticias» y se muestra solo si la sección «Kit de prensa» está visible.

export interface ContenidoKit {
  titulo: string;
  intro?: string;
  descripcion: string;
  contactoPrensa?: string;
  correoPrensa?: string;
}

export function KitPrensa({ contenido: c }: { contenido: ContenidoKit }) {
  const { data: sitio } = useQuery(consultas.sitio());
  const { data: recursos } = useQuery(
    consultas.recursos({ pagina: 1, porPagina: POR_PAGINA_RECURSOS, tipo: "PRESS_KIT" }),
  );
  const logos = [
    { nombre: "Logotipo para fondo claro", imagen: sitio?.logos.claro },
    { nombre: "Logotipo para fondo oscuro", imagen: sitio?.logos.oscuro },
  ].filter((l) => l.imagen);
  const archivos = recursos?.items ?? [];

  return (
    <section id="kit-prensa" aria-labelledby="kit-prensa-titulo" className="kit-prensa">
      <h2 id="kit-prensa-titulo">{c.titulo}</h2>
      {c.intro && <p className="seccion__intro">{c.intro}</p>}

      <h3>Quiénes somos, en breve</h3>
      {/* Texto para citar tal cual: se puede seleccionar y copiar. */}
      <p className="kit-prensa__texto">{c.descripcion}</p>

      {(c.contactoPrensa || c.correoPrensa) && (
        <>
          <h3>Contacto de prensa</h3>
          <p>
            {c.contactoPrensa}
            {c.contactoPrensa && c.correoPrensa ? " · " : ""}
            {c.correoPrensa && <a href={`mailto:${c.correoPrensa}`}>{c.correoPrensa}</a>}
          </p>
        </>
      )}

      {logos.length > 0 && (
        <>
          <h3>Logotipos</h3>
          <ul className="kit-prensa__logos">
            {logos.map((l) => (
              <li key={l.nombre}>
                <div className="kit-prensa__logo">
                  <Img imagen={l.imagen!} />
                </div>
                <a href={l.imagen!.url} target="_blank" rel="noopener noreferrer">
                  {`${l.nombre} `}
                  <span className="visually-hidden">(se abre en una pestaña nueva)</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {archivos.length > 0 && (
        <>
          <h3>Material para descargar</h3>
          <ul className="kit-prensa__archivos">
            {archivos.map((r, i) => {
              const href = r.file?.url ?? r.doiUrl ?? r.externalUrl;
              if (!href) return null;
              return (
                <li key={`${i}-${r.title}`}>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {r.title}
                    {r.file ? ` (PDF, ${tamanoLegible(r.file.sizeBytes)}) ` : " "}
                    <span className="visually-hidden">(se abre en una pestaña nueva)</span>
                  </a>
                  {r.description && <span className="kit-prensa__detalle"> {r.description}</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
