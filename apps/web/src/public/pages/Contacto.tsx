import { useQuery } from "@tanstack/react-query";
import { Redes } from "../components";
import { ContactForm } from "../ContactForm";
import { consultas } from "../data";
import { PaginaSecciones } from "../sections";

interface ContenidoContacto {
  formularioTitulo?: string;
  mensajeExito?: string;
}

export default function Contacto() {
  const { data: sitio } = useQuery(consultas.sitio());
  const { data: pagina } = useQuery(consultas.pagina("contacto"));
  const seccion = pagina?.secciones.find((s) => s.key === "contacto")?.content as
    ContenidoContacto | undefined;
  const c = sitio?.contacto;
  const hayDatos = c && (c.telefono || c.correo || c.direccion || c.redes.length > 0);

  return (
    <PaginaSecciones slug="contacto" tituloRespaldo="Contacto">
      <div className="container seccion contacto">
        {hayDatos && (
          <section aria-labelledby="datos-contacto" className="contacto__datos">
            <h2 id="datos-contacto">Datos de contacto</h2>
            <dl>
              {c.telefono && (
                <div>
                  <dt>Teléfono</dt>
                  <dd>
                    <a href={`tel:${c.telefono.replace(/[^\d+]/g, "")}`}>{c.telefono}</a>
                  </dd>
                </div>
              )}
              {c.correo && (
                <div>
                  <dt>Correo</dt>
                  <dd>
                    <a href={`mailto:${c.correo}`}>{c.correo}</a>
                  </dd>
                </div>
              )}
              {c.direccion && (
                <div>
                  <dt>Dirección</dt>
                  <dd>{c.direccion}</dd>
                </div>
              )}
            </dl>
            <Redes redes={c.redes} etiqueta="Redes sociales" />
          </section>
        )}
        <ContactForm
          titulo={seccion?.formularioTitulo ?? "Envíanos un mensaje"}
          mensajeExito={seccion?.mensajeExito ?? "Recibimos tu mensaje."}
        />
      </div>
    </PaginaSecciones>
  );
}
