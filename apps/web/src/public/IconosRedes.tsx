import type { ReactNode, SVGProps } from "react";

// Íconos de redes sociales, dibujados con el mismo trazo que src/shared/ui/Icons.tsx.
// Son decorativos (aria-hidden): el nombre de la red va en el texto del enlace.

type Props = SVGProps<SVGSVGElement>;

export type Red =
  | "instagram"
  | "facebook"
  | "x"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "whatsapp"
  | "github"
  | "telegram"
  | "web";

// Se reconoce por el nombre que escribió quien edita o por el dominio del enlace.
const PATRONES: [Red, RegExp][] = [
  ["instagram", /instagram|instagr\.am/],
  ["facebook", /facebook|fb\.(com|me)/],
  ["x", /twitter|(^|[/.])x\.com|^x$/],
  ["linkedin", /linkedin|lnkd\.in/],
  ["youtube", /youtube|youtu\.be/],
  ["tiktok", /tiktok/],
  ["whatsapp", /whatsapp|wa\.me/],
  ["github", /github/],
  ["telegram", /telegram|(^|[/.])t\.me/],
];

export function detectarRed(red: string, url: string): Red {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // URL inválida: se decide solo por el nombre.
  }
  const texto = `${red.trim().toLowerCase()} ${host.toLowerCase()}`;
  const nombre = red.trim().toLowerCase();
  for (const [clave, patron] of PATRONES) {
    if (patron.test(nombre) || patron.test(host) || patron.test(texto)) return clave;
  }
  return "web";
}

function Base({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
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

const DIBUJOS: Record<Red, ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </>
  ),
  facebook: (
    <path d="M14.5 3H13a4 4 0 0 0-4 4v3H6.5v3.5H9V21h3.5v-7.5h2.7l.5-3.5h-3.2V7.5a1 1 0 0 1 1-1h2V3z" />
  ),
  x: (
    <>
      <path d="M4 4h4.2L20 20h-4.2z" />
      <path d="M19.5 4l-6.4 7.2M4.5 20l6.4-7.2" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10.5V17M8 7.25v.01M12 17v-6.5M12 13.5a2.5 2.5 0 0 1 5 0V17" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.2 9.2l4.6 2.8-4.6 2.8z" fill="currentColor" />
    </>
  ),
  tiktok: <path d="M13.5 3v11.6a3.6 3.6 0 1 1-3.6-3.6M13.5 3c.4 2.7 2.4 4.6 5 4.8" />,
  whatsapp: (
    <>
      <path d="M3.5 20.5l1.4-4.1A8.6 8.6 0 1 1 8.4 19.4z" />
      <path d="M9 8.8c0 3.4 2.8 6.2 6.2 6.2l1.1-1.7-2.2-1.1-.9.9a4 4 0 0 1-2.3-2.3l.9-.9L10.7 7.7z" />
    </>
  ),
  github: (
    <path d="M9 19.5c-4.3 1.4-4.3-2.2-6-2.7m12 4.2v-3.3a2.9 2.9 0 0 0-.8-2.2c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.5 11.5 0 0 0-6 0C6.5 2.8 5.5 3.1 5.5 3.1a4.3 4.3 0 0 0-.1 3.2 4.6 4.6 0 0 0-1.3 3.2c0 4.7 2.8 5.7 5.5 6a2.9 2.9 0 0 0-.8 2.2V21" />
  ),
  telegram: (
    <>
      <path d="M21 4L3 11.2l6.2 2.1L11.5 20l3.2-4.2 4.8 3.7z" />
      <path d="M9.2 13.3L21 4" />
    </>
  ),
  web: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </>
  ),
};

export function IconoRed({ red, ...props }: Props & { red: Red }) {
  return <Base {...props}>{DIBUJOS[red]}</Base>;
}
