import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { apiFetch, ApiError, mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { ErrorSummary } from "@shared/ui/ErrorSummary";
import { TextArea, TextField } from "@shared/ui/Field";
import { useToast } from "@shared/ui/Toast";

// Formulario de contacto. Valida en línea (al salir de cada campo y al enviar),
// guarda un borrador en esta pestaña para no perder lo escrito, y muestra los
// errores del servidor junto a cada campo.

type Campo = "nombre" | "correo" | "telefono" | "asunto" | "mensaje";
type Valores = Record<Campo, string>;

const VACIO: Valores = { nombre: "", correo: "", telefono: "", asunto: "", mensaje: "" };
const CLAVE_BORRADOR = "signal-contacto-borrador";

// Mismas reglas que el servidor (server/src/routes/public.ts).
function validar(v: Valores): Partial<Record<Campo, string>> {
  const e: Partial<Record<Campo, string>> = {};
  if (!v.nombre.trim()) e.nombre = "Escribe tu nombre.";
  if (!v.correo.trim()) e.correo = "Escribe tu correo para poder responderte.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.correo.trim())) {
    e.correo = "Escribe un correo válido, por ejemplo nombre@dominio.cl.";
  }
  if (v.telefono && !/^[+\d\s()-]*$/.test(v.telefono)) {
    e.telefono = "Escribe solo números, espacios y los signos + ( ) -.";
  }
  if (v.mensaje.trim().length < 10) e.mensaje = "Cuéntanos un poco más: al menos 10 caracteres.";
  else if (v.mensaje.length > 3000) e.mensaje = "El mensaje admite hasta 3000 caracteres.";
  return e;
}

function leerBorrador(): Valores {
  try {
    return { ...VACIO, ...JSON.parse(sessionStorage.getItem(CLAVE_BORRADOR) ?? "{}") };
  } catch {
    return VACIO;
  }
}

export function ContactForm({ titulo, mensajeExito }: { titulo: string; mensajeExito: string }) {
  const toast = useToast();
  const base = useId();
  const id = (c: Campo) => `${base}-${c}`;
  const [valores, setValores] = useState<Valores>(leerBorrador);
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({});
  const [delServidor, setDelServidor] = useState<Partial<Record<Campo, string>>>({});
  const [resumen, setResumen] = useState<{ campoId: string; mensaje: string }[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const trampa = useRef<HTMLInputElement>(null);
  const confirmacion = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(valores));
    } catch {
      // Sin almacenamiento: el borrador dura mientras la página esté abierta.
    }
  }, [valores]);

  useEffect(() => {
    if (enviado) confirmacion.current?.focus();
  }, [enviado]);

  const errores = validar(valores);
  const errorDe = (c: Campo) => delServidor[c] ?? (tocados[c] ? errores[c] : undefined);

  const cambiar = (c: Campo) => (e: { target: { value: string } }) => {
    setValores((v) => ({ ...v, [c]: e.target.value }));
    setDelServidor((d) => ({ ...d, [c]: undefined }));
  };
  const salir = (c: Campo) => () => setTocados((t) => ({ ...t, [c]: true }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setTocados({ nombre: true, correo: true, telefono: true, asunto: true, mensaje: true });
    const lista = (Object.keys(errores) as Campo[]).map((c) => ({
      campoId: id(c),
      mensaje: errores[c]!,
    }));
    setResumen(lista);
    if (lista.length) return;

    setEnviando(true);
    try {
      const res = await apiFetch<{ mensaje: string }>("/api/public/contact", {
        method: "POST",
        body: {
          nombre: valores.nombre,
          correo: valores.correo.trim(),
          telefono: valores.telefono || undefined,
          asunto: valores.asunto || undefined,
          mensaje: valores.mensaje,
          sitioWeb: trampa.current?.value || undefined,
        },
      });
      sessionStorage.removeItem(CLAVE_BORRADOR);
      setValores(VACIO);
      setTocados({});
      setEnviado(res.mensaje || mensajeExito);
      toast.exito("Mensaje enviado.");
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.campos).length) {
        setDelServidor(err.campos as Partial<Record<Campo, string>>);
        setResumen(
          Object.entries(err.campos).map(([c, m]) => ({ campoId: id(c as Campo), mensaje: m })),
        );
      } else {
        toast.error(
          `No pudimos enviar tu mensaje. ${mensajeDeError(err)} Lo que escribiste sigue aquí.`,
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="formulario-enviado" role="status" tabIndex={-1} ref={confirmacion}>
        <h2>¡Gracias!</h2>
        <p>{enviado}</p>
        <Button variante="secundario" onClick={() => setEnviado(null)}>
          Enviar otro mensaje
        </Button>
      </div>
    );
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate aria-labelledby={`${base}-titulo`}>
      <h2 id={`${base}-titulo`}>{titulo}</h2>
      <ErrorSummary errores={resumen} />
      <TextField
        id={id("nombre")}
        label="Nombre"
        autoComplete="name"
        value={valores.nombre}
        onChange={cambiar("nombre")}
        onBlur={salir("nombre")}
        error={errorDe("nombre")}
      />
      <TextField
        id={id("correo")}
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={valores.correo}
        onChange={cambiar("correo")}
        onBlur={salir("correo")}
        error={errorDe("correo")}
      />
      <TextField
        id={id("telefono")}
        label="Teléfono"
        opcional
        type="tel"
        autoComplete="tel"
        value={valores.telefono}
        onChange={cambiar("telefono")}
        onBlur={salir("telefono")}
        error={errorDe("telefono")}
      />
      <TextField
        id={id("asunto")}
        label="Asunto"
        opcional
        value={valores.asunto}
        onChange={cambiar("asunto")}
        onBlur={salir("asunto")}
        error={errorDe("asunto")}
        maxLength={150}
      />
      <TextArea
        id={id("mensaje")}
        label="Mensaje"
        ayuda={`${valores.mensaje.length} de 3000 caracteres.`}
        value={valores.mensaje}
        onChange={cambiar("mensaje")}
        onBlur={salir("mensaje")}
        error={errorDe("mensaje")}
        rows={6}
      />
      {/* Campo trampa para bots: fuera de la vista, del lector y del orden de tabulación. */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor={`${base}-sitio`}>No completes este campo</label>
        <input id={`${base}-sitio`} ref={trampa} name="sitioWeb" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" cargando={enviando} textoCargando="Enviando…">
        Enviar mensaje
      </Button>
    </form>
  );
}
