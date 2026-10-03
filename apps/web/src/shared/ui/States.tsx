import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "./Button";
import { IconoAlerta, IconoBandeja } from "./Icons";

// --- Carga -------------------------------------------------------------------

// Bloque gris animado que ocupa el lugar del contenido. Es decorativo: lo que se
// anuncia es la etiqueta de <Cargando>.
export function Skeleton({
  ancho = "100%",
  alto = "1em",
  style,
}: {
  ancho?: string;
  alto?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{ width: ancho, height: alto, ...style }}
    />
  );
}

export function Cargando({
  etiqueta = "Cargando…",
  children,
}: {
  etiqueta?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">{etiqueta}</span>
      {children}
    </div>
  );
}

// --- Vacío y error -----------------------------------------------------------

export function EmptyState({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="estado">
      <IconoBandeja className="estado__icono" />
      <p className="estado__titulo">{titulo}</p>
      {texto && <p className="estado__texto">{texto}</p>}
      {accion}
    </div>
  );
}

// Error de carga con un mensaje que dice qué pasó y cómo resolverlo, y un botón
// para reintentar sin recargar la página.
export function ErrorState({
  titulo = "No pudimos cargar esta información",
  mensaje,
  onReintentar,
}: {
  titulo?: string;
  mensaje: string;
  onReintentar?: () => void;
}) {
  return (
    <div className="estado estado--error" role="alert">
      <IconoAlerta className="estado__icono" />
      <p className="estado__titulo">{titulo}</p>
      <p className="estado__texto">{mensaje}</p>
      {onReintentar && (
        <Button variante="secundario" onClick={onReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

// --- Entrada al hacer scroll --------------------------------------------------

// Hace aparecer el contenido al entrar en pantalla. Solo CSS + IntersectionObserver
// (sin librerías en la landing). Con prefers-reduced-motion, el CSS lo muestra fijo.
export function Reveal({
  children,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  as?: "div" | "section" | "li";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`revelar ${visible ? "revelar--visible" : ""} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}
