import { useId, useRef, useState, type PointerEvent } from "react";
import { mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { useToast } from "@shared/ui/Toast";
import { adminFetch, type MediaItem } from "./api";

// Encuadre de una imagen dentro de un marco de proporción fija (foto cuadrada,
// portada 16:9). Se arrastra con el puntero o se ajusta con tres controles
// deslizantes, que también funcionan con teclado y lector (WCAG 2.5.7).
// El servidor hace el recorte: la original queda intacta en la biblioteca.

interface Encuadre {
  zoom: number; // 1 = la imagen llena el marco por su lado más corto
  h: number; // 0–100: posición horizontal dentro del margen libre
  v: number; // 0–100: posición vertical
}

const INICIAL: Encuadre = { zoom: 1, h: 50, v: 50 };
const ZOOM_MAX = 4;

// Área recortada, en píxeles de la imagen guardada.
function area(ancho: number, alto: number, proporcion: number, e: Encuadre) {
  const anchoBase = Math.min(ancho, alto * proporcion);
  const w = anchoBase / e.zoom;
  const h = w / proporcion;
  const x = ((ancho - w) * e.h) / 100;
  const y = ((alto - h) * e.v) / 100;
  return { x, y, w, h };
}

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function RecorteImagen({
  imagen,
  proporcion,
  nombreMarco,
  onCerrar,
  onRecortada,
}: {
  // null: diálogo cerrado.
  imagen: { id: string; url: string } | null;
  proporcion: number;
  // Para los textos: «cuadrado», «horizontal 16:9».
  nombreMarco: string;
  onCerrar: () => void;
  onRecortada: (media: MediaItem) => void;
}) {
  const id = useId();
  const toast = useToast();
  const marco = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; y: number } | null>(null);
  const [natural, setNatural] = useState<{ ancho: number; alto: number } | null>(null);
  const [e, setE] = useState(INICIAL);
  const [guardando, setGuardando] = useState(false);

  const recorte = natural ? area(natural.ancho, natural.alto, proporcion, e) : null;

  function moverConPuntero(ev: PointerEvent<HTMLDivElement>) {
    if (!arrastre.current || !natural || !recorte || !marco.current) return;
    const escala = recorte.w / marco.current.clientWidth; // píxeles de imagen por píxel de pantalla
    const dx = (ev.clientX - arrastre.current.x) * escala;
    const dy = (ev.clientY - arrastre.current.y) * escala;
    arrastre.current = { x: ev.clientX, y: ev.clientY };
    const libreX = natural.ancho - recorte.w;
    const libreY = natural.alto - recorte.h;
    setE((a) => ({
      ...a,
      h: libreX > 0 ? limitar(a.h - (dx / libreX) * 100, 0, 100) : 50,
      v: libreY > 0 ? limitar(a.v - (dy / libreY) * 100, 0, 100) : 50,
    }));
  }

  async function usar() {
    if (!imagen || !recorte) return;
    setGuardando(true);
    try {
      const { media } = await adminFetch<{ media: MediaItem }>(`/media/${imagen.id}/crop`, {
        method: "POST",
        body: {
          x: Math.round(recorte.x),
          y: Math.round(recorte.y),
          width: Math.max(16, Math.floor(recorte.w)),
          height: Math.max(16, Math.floor(recorte.h)),
        },
      });
      onRecortada(media);
      toast.exito("Imagen recortada.");
      cerrar();
    } catch (err) {
      toast.error(`No se pudo recortar. ${mensajeDeError(err)}`);
    } finally {
      setGuardando(false);
    }
  }

  function cerrar() {
    setE(INICIAL);
    setNatural(null);
    onCerrar();
  }

  const control = (
    clave: keyof Encuadre,
    etiqueta: string,
    min: number,
    max: number,
    paso: number,
  ) => (
    <div className="campo recorte__control">
      <label htmlFor={`${id}-${clave}`} className="campo__label">
        {etiqueta}
      </label>
      <input
        id={`${id}-${clave}`}
        type="range"
        min={min}
        max={max}
        step={paso}
        value={e[clave]}
        aria-valuetext={
          clave === "zoom" ? `${Math.round(e.zoom * 100)} %` : `${Math.round(e[clave])} %`
        }
        onChange={(ev) => setE({ ...e, [clave]: Number(ev.target.value) })}
      />
    </div>
  );

  return (
    <Dialog
      abierto={imagen !== null}
      onCerrar={cerrar}
      titulo="Encuadrar la imagen"
      descripcion={
        <p>
          El marco es {nombreMarco}. Arrastra la imagen o usa los controles para elegir qué parte se
          ve. La imagen original se conserva.
        </p>
      }
      acciones={
        <>
          <Button variante="secundario" onClick={cerrar}>
            Cancelar
          </Button>
          <Button cargando={guardando} textoCargando="Recortando…" onClick={usar}>
            Usar este encuadre
          </Button>
        </>
      }
    >
      {imagen && (
        <div className="recorte">
          {/* El arrastre es un atajo con puntero; los controles de abajo son la alternativa. */}
          <div
            ref={marco}
            className="recorte__marco"
            style={{ aspectRatio: String(proporcion), ["--proporcion" as string]: proporcion }}
            onPointerDown={(ev) => {
              ev.currentTarget.setPointerCapture(ev.pointerId);
              arrastre.current = { x: ev.clientX, y: ev.clientY };
            }}
            onPointerMove={moverConPuntero}
            onPointerUp={() => (arrastre.current = null)}
            onPointerCancel={() => (arrastre.current = null)}
          >
            <img
              src={imagen.url}
              alt=""
              draggable={false}
              onLoad={(ev) =>
                setNatural({
                  ancho: ev.currentTarget.naturalWidth,
                  alto: ev.currentTarget.naturalHeight,
                })
              }
              style={
                recorte && natural
                  ? {
                      width: `${(natural.ancho / recorte.w) * 100}%`,
                      left: `${(-recorte.x / recorte.w) * 100}%`,
                      top: `${(-recorte.y / recorte.h) * 100}%`,
                    }
                  : { visibility: "hidden" }
              }
            />
          </div>
          <div className="recorte__controles">
            {control("zoom", "Acercar", 1, ZOOM_MAX, 0.05)}
            {control("h", "Posición horizontal", 0, 100, 1)}
            {control("v", "Posición vertical", 0, 100, 1)}
            <Button variante="fantasma" onClick={() => setE(INICIAL)}>
              Centrar
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
