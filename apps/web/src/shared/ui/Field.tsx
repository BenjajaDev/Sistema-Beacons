import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { IconoAlerta } from "./Icons";

// Campos de formulario accesibles: <label> asociado, ayuda y error enlazados con
// aria-describedby, aria-invalid y marca de obligatorio u opcional en el texto
// (no solo con color o asterisco).

interface CampoBase {
  label: string;
  ayuda?: ReactNode;
  error?: string | null;
  // Por defecto los campos son obligatorios y se marcan los opcionales,
  // que suelen ser menos en los formularios de este sitio.
  opcional?: boolean;
}

function useCampo(id: string | undefined, { ayuda, error }: CampoBase) {
  const generado = useId();
  const controlId = id ?? `campo-${generado}`;
  const ayudaId = ayuda ? `${controlId}-ayuda` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return {
    controlId,
    ayudaId,
    errorId,
    describedBy: [errorId, ayudaId].filter(Boolean).join(" ") || undefined,
  };
}

function Envoltura({
  campo,
  ids,
  children,
}: {
  campo: CampoBase;
  ids: ReturnType<typeof useCampo>;
  children: ReactNode;
}) {
  return (
    <div className="campo">
      <label className="campo__label" htmlFor={ids.controlId}>
        {campo.label}
        {campo.opcional && <span className="campo__opcional"> (opcional)</span>}
      </label>
      {campo.ayuda && (
        <div className="campo__ayuda" id={ids.ayudaId}>
          {campo.ayuda}
        </div>
      )}
      {children}
      {campo.error && (
        <p className="campo__error" id={ids.errorId}>
          <IconoAlerta width="1.1em" height="1.1em" />
          <span>{campo.error}</span>
        </p>
      )}
    </div>
  );
}

type TextFieldProps = CampoBase & Omit<InputHTMLAttributes<HTMLInputElement>, "required">;

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, ayuda, error, opcional, id, className = "", ...props },
  ref,
) {
  const campo = { label, ayuda, error, opcional };
  const ids = useCampo(id, campo);
  return (
    <Envoltura campo={campo} ids={ids}>
      <input
        ref={ref}
        id={ids.controlId}
        className={`campo__control ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        aria-required={!opcional || undefined}
        {...props}
      />
    </Envoltura>
  );
});

type TextAreaProps = CampoBase & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "required">;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, ayuda, error, opcional, id, className = "", ...props },
  ref,
) {
  const campo = { label, ayuda, error, opcional };
  const ids = useCampo(id, campo);
  return (
    <Envoltura campo={campo} ids={ids}>
      <textarea
        ref={ref}
        id={ids.controlId}
        className={`campo__control ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        aria-required={!opcional || undefined}
        {...props}
      />
    </Envoltura>
  );
});

type SelectFieldProps = CampoBase & Omit<SelectHTMLAttributes<HTMLSelectElement>, "required">;

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, ayuda, error, opcional, id, className = "", children, ...props },
  ref,
) {
  const campo = { label, ayuda, error, opcional };
  const ids = useCampo(id, campo);
  return (
    <Envoltura campo={campo} ids={ids}>
      <select
        ref={ref}
        id={ids.controlId}
        className={`campo__control ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        aria-required={!opcional || undefined}
        {...props}
      >
        {children}
      </select>
    </Envoltura>
  );
});
