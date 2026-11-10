import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { apiFetch, ApiError, mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { TextField } from "@shared/ui/Field";
import { IconoAlerta } from "@shared/ui/Icons";
import { useToast } from "@shared/ui/Toast";
import { consultas, useTituloPagina } from "./data";

// Suscripción al boletín y página de baja. El consentimiento es expreso: la casilla
// nace sin marcar y su texto es el que se guarda junto con la suscripción.

export interface ContenidoBoletin {
  titulo: string;
  intro?: string;
  textoConsentimiento: string;
  avisoPrivacidad?: string;
  textoBoton: string;
  mensajeExito: string;
}

type Campo = "correo" | "nombre" | "consentimiento";

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FormularioBoletin({
  contenido,
  idTitulo,
}: {
  contenido: ContenidoBoletin;
  idTitulo: string;
}) {
  const toast = useToast();
  const base = useId();
  const id = (c: Campo) => `${base}-${c}`;
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const trampa = useRef<HTMLInputElement>(null);
  const confirmacion = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (enviado) confirmacion.current?.focus();
  }, [enviado]);

  function validar() {
    const e: Partial<Record<Campo, string>> = {};
    if (!correo.trim()) e.correo = "Escribe tu correo.";
    else if (!CORREO.test(correo.trim())) {
      e.correo = "Escribe un correo válido, por ejemplo nombre@dominio.cl.";
    }
    if (!acepta) e.consentimiento = "Marca la casilla para aceptar recibir el boletín.";
    return e;
  }

  // Con pocos campos no hace falta un resumen: se lleva el foco al primer error.
  function irAlPrimerError(e: Partial<Record<Campo, string>>) {
    const primero = (["correo", "consentimiento"] as const).find((c) => e[c]);
    if (primero) document.getElementById(id(primero))?.focus();
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length) {
      // Espera a que los errores estén en pantalla para enfocar el campo.
      requestAnimationFrame(() => irAlPrimerError(e));
      return;
    }
    setEnviando(true);
    try {
      const res = await apiFetch<{ mensaje: string }>("/api/public/newsletter", {
        method: "POST",
        body: {
          correo: correo.trim(),
          nombre: nombre.trim() || undefined,
          consentimiento: true,
          sitioWeb: trampa.current?.value || undefined,
        },
      });
      setEnviado(res.mensaje || contenido.mensajeExito);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.campos).length) {
        const delServidor = err.campos as Partial<Record<Campo, string>>;
        setErrores(delServidor);
        requestAnimationFrame(() => irAlPrimerError(delServidor));
      } else {
        toast.error(`No pudimos suscribirte. ${mensajeDeError(err)} Lo que escribiste sigue aquí.`);
      }
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="formulario-enviado" role="status" tabIndex={-1} ref={confirmacion}>
        <p>{enviado}</p>
      </div>
    );
  }

  const ayudaId = contenido.avisoPrivacidad ? `${base}-privacidad` : undefined;
  return (
    <form className="boletin__formulario" onSubmit={enviar} noValidate aria-labelledby={idTitulo}>
      <TextField
        id={id("correo")}
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={correo}
        onChange={(e) => {
          setCorreo(e.target.value);
          setErrores((x) => ({ ...x, correo: undefined }));
        }}
        error={errores.correo}
      />
      <TextField
        id={id("nombre")}
        label="Nombre"
        opcional
        autoComplete="name"
        maxLength={120}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <div className="campo">
        <label className="casilla">
          <input
            id={id("consentimiento")}
            type="checkbox"
            checked={acepta}
            aria-invalid={errores.consentimiento ? true : undefined}
            aria-describedby={
              [errores.consentimiento && `${base}-consentimiento-error`, ayudaId]
                .filter(Boolean)
                .join(" ") || undefined
            }
            onChange={(e) => {
              setAcepta(e.target.checked);
              setErrores((x) => ({ ...x, consentimiento: undefined }));
            }}
          />
          <span>{contenido.textoConsentimiento}</span>
        </label>
        {errores.consentimiento && (
          <p className="campo__error" id={`${base}-consentimiento-error`}>
            <IconoAlerta width="1.1em" height="1.1em" />
            <span>{errores.consentimiento}</span>
          </p>
        )}
      </div>
      {contenido.avisoPrivacidad && (
        <p className="campo__ayuda" id={ayudaId}>
          {contenido.avisoPrivacidad}
        </p>
      )}
      {/* Campo trampa para bots: fuera de la vista, del lector y del orden de tabulación. */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor={`${base}-sitio`}>No completes este campo</label>
        <input id={`${base}-sitio`} ref={trampa} name="sitioWeb" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" cargando={enviando} textoCargando="Enviando…">
        {contenido.textoBoton}
      </Button>
    </form>
  );
}

// --- Página de baja ---------------------------------------------------------------

// La baja pide una confirmación (un botón) y no ocurre al abrir el enlace: los
// programas de correo y los antivirus abren los enlaces por su cuenta.
export default function BajaBoletin() {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const refH1 = useTituloPagina("Baja del boletín");
  const { data: sitio } = useQuery(consultas.sitio());
  const [estado, setEstado] = useState<"pendiente" | "enviando" | "hecho" | "invalido" | "error">(
    token ? "pendiente" : "invalido",
  );
  const resultado = useRef<HTMLDivElement>(null);
  const correo = sitio?.contacto.correo;

  useEffect(() => {
    if (estado === "hecho" || estado === "invalido") resultado.current?.focus();
  }, [estado]);

  async function darDeBaja() {
    setEstado("enviando");
    try {
      await apiFetch("/api/public/newsletter/unsubscribe", { method: "POST", body: { token } });
      setEstado("hecho");
    } catch (err) {
      setEstado(err instanceof ApiError && err.status === 404 ? "invalido" : "error");
    }
  }

  return (
    <div className="container seccion boletin-baja">
      <h1 ref={refH1} tabIndex={-1}>
        Baja del boletín
      </h1>
      {(estado === "pendiente" || estado === "enviando" || estado === "error") && (
        <>
          <p>¿Quieres dejar de recibir el boletín de SIGNAL? Confirma y no te escribiremos más.</p>
          {estado === "error" && (
            <p className="campo__error" role="alert">
              <IconoAlerta width="1.1em" height="1.1em" />
              <span>No pudimos darte de baja. Revisa tu conexión e intenta de nuevo.</span>
            </p>
          )}
          <Button cargando={estado === "enviando"} textoCargando="Procesando…" onClick={darDeBaja}>
            Darme de baja
          </Button>
        </>
      )}
      {estado === "hecho" && (
        <div className="formulario-enviado" role="status" tabIndex={-1} ref={resultado}>
          <p>
            Listo: no recibirás más correos del boletín. Si fue un error, puedes volver a
            suscribirte cuando quieras.
          </p>
        </div>
      )}
      {estado === "invalido" && (
        <div role="status" tabIndex={-1} ref={resultado}>
          <p>
            Este enlace de baja no es válido o ya no existe.
            {correo ? (
              <>
                {" Escríbenos a "}
                <a href={`mailto:${correo}`}>{correo}</a>
                {" y te damos de baja."}
              </>
            ) : (
              " Escríbenos desde la página de contacto y te damos de baja."
            )}
          </p>
        </div>
      )}
    </div>
  );
}
