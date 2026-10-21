import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { Img, Redes } from "./components";
import type { Persona } from "./data";
import { ajusteDentroDePantalla, useCardsEquipo, type CardAbierta } from "./useCardsEquipo";

// El equipo en una fila (5 por fila en pantallas anchas). Cada persona es un botón
// de divulgación: al apuntar con el mouse, o al activarlo con clic, toque o
// teclado, despliega bajo ella una card con su información.

export function EquipoFila({ personas }: { personas: Persona[] }) {
  const lista = useRef<HTMLUListElement>(null);
  const cards = useCardsEquipo(lista);
  return (
    <ul ref={lista} className="equipo">
      {personas.map((p, i) => (
        <Integrante
          key={`${p.name}-${i}`}
          persona={p}
          estado={cards.abierta?.indice === i ? cards.abierta : null}
          onApuntar={() => cards.alApuntar(i)}
          onRetirar={() => cards.alRetirar(i)}
          onActivar={(conTeclado) => cards.alActivar(i, conTeclado)}
          onCerrar={cards.cerrar}
        />
      ))}
    </ul>
  );
}

function Integrante({
  persona: p,
  estado,
  onApuntar,
  onRetirar,
  onActivar,
  onCerrar,
}: {
  persona: Persona;
  estado: CardAbierta | null;
  onApuntar: () => void;
  onRetirar: () => void;
  onActivar: (conTeclado: boolean) => void;
  onCerrar: () => void;
}) {
  const idCard = useId();
  const zona = useRef<HTMLLIElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const abierta = estado !== null;

  // Al abrir, corre la card lo justo para que no se salga de la pantalla. Se
  // escribe directo en el elemento: es solo posición y no necesita otro render.
  useLayoutEffect(() => {
    const el = card.current;
    if (!abierta || !el) return;
    el.style.setProperty("--ajuste", "0px");
    const ajuste = ajusteDentroDePantalla(
      el.getBoundingClientRect(),
      document.documentElement.clientWidth,
    );
    el.style.setProperty("--ajuste", `${ajuste}px`);
  }, [abierta]);

  // La persona y su card son la zona de apuntado; el control es el botón. Por eso
  // estos eventos se escuchan en el elemento y no como props de un <li>.
  useEffect(() => {
    const el = zona.current;
    if (!el) return;
    // Solo el mouse abre al apuntar: en pantallas táctiles el toque es un clic.
    const entra = (e: PointerEvent) => {
      if (e.pointerType === "mouse") onApuntar();
    };
    const sale = (e: PointerEvent) => {
      if (e.pointerType === "mouse") onRetirar();
    };
    // Escape cierra (lo maneja el hook) y devuelve el foco a la persona si estaba en la card.
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && card.current?.contains(document.activeElement)) {
        boton.current?.focus();
      }
    };
    // El foco salió de esta persona y su card: se cierra.
    const foco = (e: FocusEvent) => {
      if (abierta && !el.contains(e.relatedTarget as Node | null)) onCerrar();
    };
    el.addEventListener("pointerenter", entra);
    el.addEventListener("pointerleave", sale);
    el.addEventListener("keydown", tecla);
    el.addEventListener("focusout", foco);
    return () => {
      el.removeEventListener("pointerenter", entra);
      el.removeEventListener("pointerleave", sale);
      el.removeEventListener("keydown", tecla);
      el.removeEventListener("focusout", foco);
    };
  }, [abierta, onApuntar, onRetirar, onCerrar]);

  const detalle = [p.area, p.education].filter(Boolean).join(" · ");

  return (
    <li ref={zona} className="integrante" data-abierta={abierta || undefined}>
      <h3 className="integrante__titulo">
        <button
          ref={boton}
          type="button"
          className="integrante__boton"
          aria-expanded={abierta}
          aria-controls={idCard}
          // detail === 0: lo activó el teclado (Enter o Espacio), no un clic.
          onClick={(e) => onActivar(e.detail === 0)}
        >
          <span className="integrante__marco">
            {p.photo ? (
              // Decorativa: el nombre del botón ya identifica a la persona.
              <Img imagen={{ ...p.photo, alt: "" }} className="integrante__foto" />
            ) : (
              <span className="integrante__inicial" aria-hidden="true">
                {p.name.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <span className="integrante__nombre">{p.name}</span>{" "}
          <span className="integrante__cargo">{p.position}</span>
        </button>
      </h3>
      <div
        ref={card}
        id={idCard}
        className="integrante__card"
        data-instantanea={estado?.instantanea || undefined}
      >
        <p className="integrante__card-nombre" aria-hidden="true">
          {p.name}
        </p>
        <p className="integrante__card-cargo">{p.position}</p>
        {detalle && <p className="integrante__detalle">{detalle}</p>}
        {p.bio && <p className="integrante__bio">{p.bio}</p>}
        {p.email && (
          <p className="integrante__correo">
            <a href={`mailto:${p.email}`}>{p.email}</a>
          </p>
        )}
        <Redes redes={p.links} etiqueta={`Enlaces de ${p.name}`} variante="iconos" />
      </div>
    </li>
  );
}
