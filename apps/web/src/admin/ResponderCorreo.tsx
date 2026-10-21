import { useEffect, useId, useRef, useState } from "react";
import { useToast } from "@shared/ui/Toast";

// «Responder» a un mensaje de contacto. Un enlace mailto: depende de que el computador
// tenga una app de correo configurada (si no, el clic no hace nada), así que se
// ofrecen también Gmail y Outlook en la web y copiar la dirección.

export interface EnlacesRespuesta {
  gmail: string;
  outlook: string;
  app: string;
}

export function enlacesDeRespuesta(correo: string, asunto: string): EnlacesRespuesta {
  const para = encodeURIComponent(correo);
  const tema = encodeURIComponent(asunto);
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${para}&su=${tema}`,
    outlook: `https://outlook.office.com/mail/deeplink/compose?to=${para}&subject=${tema}`,
    app: `mailto:${para}?subject=${tema}`,
  };
}

export function ResponderCorreo({
  correo,
  nombre,
  asunto,
}: {
  correo: string;
  nombre: string;
  asunto: string;
}) {
  const id = useId();
  const toast = useToast();
  const zona = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const enlaces = enlacesDeRespuesta(correo, asunto);

  // Se cierra al tocar fuera o cuando el foco sale del menú; Escape además
  // devuelve el foco al botón.
  useEffect(() => {
    const el = zona.current;
    if (!abierto || !el) return;
    const fuera = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setAbierto(false);
      boton.current?.focus();
    };
    const foco = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    el.addEventListener("keydown", tecla);
    el.addEventListener("focusout", foco);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      el.removeEventListener("keydown", tecla);
      el.removeEventListener("focusout", foco);
    };
  }, [abierto]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(correo);
      toast.exito(`Copiamos ${correo}.`);
    } catch {
      toast.error(`No se pudo copiar. La dirección es ${correo}.`);
    }
    setAbierto(false);
    boton.current?.focus();
  }

  const nuevaPestana = <span className="visually-hidden">(se abre en una pestaña nueva)</span>;
  return (
    <div ref={zona} className="responder">
      <button
        ref={boton}
        type="button"
        className="btn btn--secundario"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
      >
        <span>
          Responder <span className="visually-hidden">a {nombre}</span>
        </span>
      </button>
      <ul id={id} className="responder__opciones" hidden={!abierto}>
        <li>
          <a
            href={enlaces.gmail}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAbierto(false)}
          >
            En Gmail {nuevaPestana}
          </a>
        </li>
        <li>
          <a
            href={enlaces.outlook}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setAbierto(false)}
          >
            En Outlook {nuevaPestana}
          </a>
        </li>
        <li>
          <a href={enlaces.app} onClick={() => setAbierto(false)}>
            En la app de correo
          </a>
        </li>
        <li>
          <button type="button" onClick={copiar}>
            Copiar la dirección
          </button>
        </li>
      </ul>
    </div>
  );
}
