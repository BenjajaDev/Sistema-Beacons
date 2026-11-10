import { useQuery } from "@tanstack/react-query";
import { Redes } from "../components";
import { detectarRed, IconoRed } from "../IconosRedes";
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
  // El botón de WhatsApp sale de la red «WhatsApp» que se carga en Contacto y redes del
  // panel (con un enlace wa.me/…): así no hay un número más que mantener.
  const whatsapp = c?.redes.find((r) => detectarRed(r.red, r.url) === "whatsapp");

  return (
    <PaginaSecciones slug="contacto" tituloRespaldo="Contacto">
      <div className="container seccion contacto">
        {hayDatos && (
          <section aria-labelledby="datos-contacto" className="contacto__datos">
            <h2 id="datos-contacto">Datos de contacto</h2>
            {whatsapp && (
              <p>
                <a
                  href={whatsapp.url}
                  className="btn btn--primario contacto__whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconoRed red="whatsapp" className="red__icono" />
                  <span>
                    Escríbenos por WhatsApp
                    <span className="visually-hidden"> (se abre en una pestaña nueva)</span>
                  </span>
                </a>
              </p>
            )}
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
                  <dd>
                    {c.direccion}
                    {/* Un enlace, no un mapa embebido: un iframe de mapa es difícil de usar
                        con teclado y lector de pantalla. */}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.direccion)}`}
                      className="contacto__como-llegar"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {"Cómo llegar "}
                      <span className="visually-hidden">
                        {`a ${c.direccion} (se abre en una pestaña nueva)`}
                      </span>
                    </a>
                  </dd>
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
