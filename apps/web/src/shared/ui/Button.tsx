import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";

type Variante = "primario" | "secundario" | "fantasma" | "peligro";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  // Mientras carga, el botón sigue siendo enfocable (aria-disabled en vez de
  // disabled) para que el foco no salte y el lector anuncie el estado.
  cargando?: boolean;
  textoCargando?: string;
  icono?: ReactNode;
}

export function Button({
  variante = "primario",
  cargando = false,
  textoCargando = "Procesando…",
  icono,
  children,
  className = "",
  onClick,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const inactivo = cargando || disabled;
  function alClic(e: MouseEvent<HTMLButtonElement>) {
    if (inactivo) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  }
  return (
    <button
      type={type}
      className={`btn btn--${variante} ${className}`.trim()}
      aria-disabled={inactivo || undefined}
      aria-busy={cargando || undefined}
      onClick={alClic}
      {...props}
    >
      {cargando ? <span className="btn__spinner" aria-hidden="true" /> : icono}
      <span>{cargando ? textoCargando : children}</span>
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  // Obligatorio: un botón solo con ícono necesita un nombre accesible (WCAG 4.1.2).
  label: string;
  children: ReactNode;
}

export function IconButton({
  label,
  children,
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`icon-btn ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
