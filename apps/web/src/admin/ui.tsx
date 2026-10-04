import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { useBlocker } from "react-router";
import { usePage } from "@shared/a11y/focus";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { ConfirmDialog, Dialog } from "@shared/ui/Dialog";
import { TextArea } from "@shared/ui/Field";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { RecorteImagen } from "./Recorte";
import { adminFetch, type MediaItem, type Pagina } from "./api";

// --- Página y cabecera ------------------------------------------------------

export function usePanelPage(titulo: string) {
  return usePage(titulo, "Panel SIGNAL");
}

export function Cabecera({
  titulo,
  descripcion,
  acciones,
  refH1,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  refH1: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="vista-cabecera">
      <div>
        <h1 ref={refH1} tabIndex={-1}>
          {titulo}
        </h1>
        {descripcion && <p className="vista-cabecera__desc">{descripcion}</p>}
      </div>
      {acciones && <div className="vista-cabecera__acciones">{acciones}</div>}
    </div>
  );
}

// --- Estados -------------------------------------------------------------------

const ESTADOS = {
  DRAFT: { texto: "Borrador", clase: "borrador" },
  REVIEW: { texto: "En revisión", clase: "revision" },
  PUBLISHED: { texto: "Publicada", clase: "publicada" },
} as const;

// El estado se dice con texto; el color solo refuerza (WCAG 1.4.1).
export function Estado({ estado, texto }: { estado: keyof typeof ESTADOS; texto?: string }) {
  const e = ESTADOS[estado];
  return <span className={`estado-insignia estado-insignia--${e.clase}`}>{texto ?? e.texto}</span>;
}

export const FECHA_HORA = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
  timeStyle: "short",
});
export const formatoFecha = (iso: string | null | undefined) =>
  iso ? FECHA_HORA.format(new Date(iso)) : "—";

// --- Interruptor -----------------------------------------------------------------

export function Interruptor({
  activo,
  onCambiar,
  etiqueta,
  ocupado,
}: {
  activo: boolean;
  onCambiar: (valor: boolean) => void;
  etiqueta: string;
  ocupado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-busy={ocupado || undefined}
      className="interruptor"
      onClick={() => !ocupado && onCambiar(!activo)}
    >
      <span className="interruptor__pista" aria-hidden="true">
        <span className="interruptor__perilla" />
      </span>
      <span>{etiqueta}</span>
    </button>
  );
}

// --- Cambios sin guardar ----------------------------------------------------------

// Avisa antes de perder cambios: al cerrar o recargar la pestaña (aviso del
// navegador) y al navegar dentro del panel (diálogo propio).
export function AvisoCambiosSinGuardar({ sucio }: { sucio: boolean }) {
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sucio && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!sucio) return;
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [sucio]);

  return (
    <ConfirmDialog
      abierto={bloqueo.state === "blocked"}
      onCerrar={() => bloqueo.state === "blocked" && bloqueo.reset()}
      titulo="Hay cambios sin guardar"
      mensaje="Si sales ahora se perderán los cambios que no guardaste."
      textoCancelar="Seguir editando"
      textoConfirmar="Salir sin guardar"
      onConfirmar={() => {
        if (bloqueo.state === "blocked") bloqueo.proceed();
      }}
    />
  );
}

// --- Errores del servidor por campo ----------------------------------------------

export function erroresDeCampos(err: unknown): Record<string, string> {
  return err instanceof ApiError ? err.campos : {};
}

// --- Imágenes ---------------------------------------------------------------------

export interface ImagenElegida {
  id: string;
  url: string;
}

function Biblioteca({
  abierto,
  onCerrar,
  onElegir,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onElegir: (m: MediaItem) => void;
}) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin", "media"],
    queryFn: () => adminFetch<Pagina<MediaItem>>("/media?limit=60"),
    enabled: abierto,
  });
  return (
    <Dialog abierto={abierto} onCerrar={onCerrar} titulo="Elegir una imagen subida">
      {isPending ? (
        <Cargando etiqueta="Cargando imágenes…">
          <Skeleton alto="8rem" />
        </Cargando>
      ) : error ? (
        <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          titulo="Aún no hay imágenes"
          texto="Sube la primera con el botón «Subir imagen»."
        />
      ) : (
        <ul className="biblioteca">
          {data.items.map((m) => (
            <li key={m.id}>
              <button type="button" className="biblioteca__item" onClick={() => onElegir(m)}>
                <img src={m.url} alt="" />
                <span>{m.originalName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="dialogo__acciones">
        <Button variante="secundario" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </Dialog>
  );
}

// Imagen con su texto alternativo, que es obligatorio: sin él el servidor no
// guarda la imagen (WCAG 1.1.1).
export function SelectorImagen({
  etiqueta,
  imagen,
  alt,
  onCambiar,
  errorImagen,
  errorAlt,
  ayudaAlt = "Describe lo que muestra la imagen, como se lo contarías a alguien por teléfono. Ejemplo: «Persona con bastón usando la app frente a una puerta».",
  sinAlt = false,
  marco,
}: {
  etiqueta: string;
  imagen: ImagenElegida | null;
  alt: string;
  onCambiar: (imagen: ImagenElegida | null, alt: string) => void;
  errorImagen?: string;
  errorAlt?: string;
  ayudaAlt?: string;
  // El favicon es decorativo: no lleva texto alternativo.
  sinAlt?: boolean;
  // Marco en que se muestra la imagen en el sitio. Si la imagen no calza, se ofrece
  // encuadrarla (recortarla) con esa proporción.
  marco?: { proporcion: number; nombre: string };
}) {
  const id = useId();
  const archivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [biblioteca, setBiblioteca] = useState(false);
  const [encuadrar, setEncuadrar] = useState<ImagenElegida | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  // Abre el encuadre si la proporción difiere más de un 2 % de la del marco.
  const revisarMarco = (m: MediaItem) => {
    if (!marco || !m.width || !m.height) return;
    if (Math.abs(m.width / m.height / marco.proporcion - 1) > 0.02) setEncuadrar(m);
  };

  async function subir(file: File) {
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append("archivo", file);
      const { media } = await adminFetch<{ media: MediaItem }>("/media", {
        method: "POST",
        body: datos,
      });
      onCambiar({ id: media.id, url: media.url }, alt);
      queryClient.invalidateQueries({ queryKey: ["admin", "media"] });
      toast.exito("Imagen subida. No olvides escribir su descripción.");
      revisarMarco(media);
    } catch (err) {
      toast.error(`No se pudo subir la imagen. ${mensajeDeError(err)}`);
    } finally {
      setSubiendo(false);
      if (archivo.current) archivo.current.value = "";
    }
  }

  return (
    <fieldset className="selector-imagen">
      <legend>{etiqueta}</legend>
      {imagen ? (
        <img
          src={imagen.url}
          alt=""
          className="selector-imagen__vista"
          style={marco ? { aspectRatio: String(marco.proporcion), objectFit: "cover" } : undefined}
        />
      ) : (
        <p className="selector-imagen__vacio">Sin imagen.</p>
      )}
      <div className="selector-imagen__acciones">
        <input
          ref={archivo}
          id={`${id}-archivo`}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="visually-hidden"
          // El control accesible es el botón «Subir imagen»; este input oculto no
          // debe recibir foco con Tab ni anunciarse.
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])}
        />
        <Button
          variante="secundario"
          cargando={subiendo}
          textoCargando="Subiendo…"
          onClick={() => archivo.current?.click()}
        >
          Subir imagen
        </Button>
        <Button variante="secundario" onClick={() => setBiblioteca(true)}>
          Elegir de las subidas
        </Button>
        {imagen && marco && (
          <Button variante="secundario" onClick={() => setEncuadrar(imagen)}>
            Encuadrar imagen
          </Button>
        )}
        {imagen && (
          <Button variante="fantasma" onClick={() => onCambiar(null, "")}>
            Quitar imagen
          </Button>
        )}
      </div>
      {errorImagen && (
        <p className="campo__error" role="alert">
          {errorImagen}
        </p>
      )}
      <p className="campo__ayuda">
        JPG, PNG, WebP o AVIF. Se quitan los datos de ubicación de las fotos.
        {marco && ` En el sitio se muestra en un marco ${marco.nombre}.`}
      </p>
      {imagen && !sinAlt && (
        <TextArea
          label="Texto alternativo"
          ayuda={ayudaAlt}
          value={alt}
          rows={2}
          maxLength={300}
          onChange={(e) => onCambiar(imagen, e.target.value)}
          error={errorAlt}
        />
      )}
      <Biblioteca
        abierto={biblioteca}
        onCerrar={() => setBiblioteca(false)}
        onElegir={(m) => {
          onCambiar({ id: m.id, url: m.url }, alt);
          setBiblioteca(false);
          revisarMarco(m);
        }}
      />
      {marco && (
        <RecorteImagen
          imagen={encuadrar}
          proporcion={marco.proporcion}
          nombreMarco={marco.nombre}
          onCerrar={() => setEncuadrar(null)}
          onRecortada={(m) => {
            onCambiar({ id: m.id, url: m.url }, alt);
            queryClient.invalidateQueries({ queryKey: ["admin", "media"] });
          }}
        />
      )}
    </fieldset>
  );
}

// --- Región con scroll horizontal (tablas) -----------------------------------------

// Debe poder enfocarse para desplazarla con el teclado (axe: scrollable-region-focusable).
export function RegionDesplazable({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- región con scroll: debe ser enfocable
    <div className="tabla-contenedor" role="region" aria-label={etiqueta} tabIndex={0}>
      {children}
    </div>
  );
}
