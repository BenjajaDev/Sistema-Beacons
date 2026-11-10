import type { SVGProps } from "react";

// Íconos que se pueden poner a una tarjeta desde el panel. La lista de claves debe
// coincidir con ICONOS_TARJETA del servidor (server/src/content/sections.ts); un
// test lo verifica. Son decorativos: el título de la tarjeta ya dice lo mismo.
type Props = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ICONOS_DE_TARJETA = {
  brujula: {
    nombre: "Brújula",
    dibujo: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5z" />
      </>
    ),
  },
  voz: {
    nombre: "Voz",
    dibujo: (
      <>
        <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
      </>
    ),
  },
  personas: {
    nombre: "Personas",
    dibujo: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4c1.8.8 3 2.6 3 5.6" />
      </>
    ),
  },
  mapa: {
    nombre: "Mapa",
    dibujo: (
      <>
        <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
        <path d="M9 4v14M15 6v14" />
      </>
    ),
  },
  libro: {
    nombre: "Libro",
    dibujo: (
      <>
        <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5C4.7 20 4 19.3 4 18.5z" />
        <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z" />
      </>
    ),
  },
  ojo: {
    nombre: "Ojo",
    dibujo: (
      <>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  senal: {
    nombre: "Señal",
    dibujo: (
      <>
        <circle cx="12" cy="12" r="1.6" />
        <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
      </>
    ),
  },
  escudo: {
    nombre: "Escudo",
    dibujo: (
      <>
        <path d="M12 3 4.5 6v5.5c0 4.4 3.2 8 7.5 9.5 4.3-1.5 7.5-5.1 7.5-9.5V6z" />
        <path d="m9 12 2.2 2.2L15.5 10" />
      </>
    ),
  },
  idea: {
    nombre: "Idea",
    dibujo: (
      <>
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
      </>
    ),
  },
  corazon: {
    nombre: "Corazón",
    dibujo: (
      <path d="M12 20s-8-4.7-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.3 12 20 12 20z" />
    ),
  },
  edificio: {
    nombre: "Edificio",
    dibujo: (
      <>
        <path d="M5 21V4.5C5 3.7 5.7 3 6.5 3h8c.8 0 1.5.7 1.5 1.5V21M16 10h2.5c.8 0 1.5.7 1.5 1.5V21M3 21h18" />
        <path d="M9 7h3M9 11h3M9 15h3" />
      </>
    ),
  },
  grafico: {
    nombre: "Gráfico",
    dibujo: (
      <>
        <path d="M4 4v16h16" />
        <path d="m8 15 3-4 3 2 5-6" />
      </>
    ),
  },
} as const;

export type ClaveIcono = keyof typeof ICONOS_DE_TARJETA;

export function IconoTarjeta({ clave, ...props }: { clave: ClaveIcono } & Props) {
  const icono = ICONOS_DE_TARJETA[clave];
  if (!icono) return null;
  return <Base {...props}>{icono.dibujo}</Base>;
}
