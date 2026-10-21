import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconButton } from "./Button";
import { IconoAlerta, IconoCerrar, IconoOk } from "./Icons";

// Avisos breves de resultado. Las regiones aria-live existen desde el inicio
// (si se crean junto con el mensaje, muchos lectores no lo anuncian):
// - éxito: role="status" (cortés), se cierra solo a los 6 s, pausa con el
//   puntero o el foco;
// - error: role="alert" (inmediato) y NO se cierra solo: hay que leerlo.

type Tipo = "ok" | "error";
interface Aviso {
  id: number;
  tipo: Tipo;
  texto: string;
}

interface ToastApi {
  exito: (texto: string) => void;
  error: (texto: string) => void;
}

const Contexto = createContext<ToastApi | null>(null);

const DURACION_EXITO = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const siguienteId = useRef(1);
  const temporizadores = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const cerrar = useCallback((id: number) => {
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.delete(id);
    setAvisos((a) => a.filter((x) => x.id !== id));
  }, []);

  const programarCierre = useCallback(
    (id: number) => {
      temporizadores.current.set(
        id,
        setTimeout(() => cerrar(id), DURACION_EXITO),
      );
    },
    [cerrar],
  );

  const mostrar = useCallback(
    (tipo: Tipo, texto: string) => {
      const id = siguienteId.current++;
      setAvisos((a) => [...a.slice(-3), { id, tipo, texto }]);
      if (tipo === "ok") programarCierre(id);
    },
    [programarCierre],
  );

  const api = useMemo<ToastApi>(
    () => ({ exito: (t) => mostrar("ok", t), error: (t) => mostrar("error", t) }),
    [mostrar],
  );

  const pausar = (id: number) => clearTimeout(temporizadores.current.get(id));

  const render = (tipo: Tipo) =>
    avisos
      .filter((a) => a.tipo === tipo)
      .map((a) => (
        // La pausa al pasar el puntero o al enfocar el botón de cerrar es una ayuda
        // para leer con calma, no una interacción: el div no necesita rol propio.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          key={a.id}
          className={`aviso aviso--${a.tipo}`}
          onMouseEnter={() => tipo === "ok" && pausar(a.id)}
          onMouseLeave={() => tipo === "ok" && programarCierre(a.id)}
          onFocus={() => tipo === "ok" && pausar(a.id)}
          onBlur={() => tipo === "ok" && programarCierre(a.id)}
        >
          {tipo === "ok" ? (
            <IconoOk width="1.4em" height="1.4em" />
          ) : (
            <IconoAlerta width="1.4em" height="1.4em" />
          )}
          <p className="aviso__texto">{a.texto}</p>
          <IconButton label="Cerrar aviso" onClick={() => cerrar(a.id)}>
            <IconoCerrar />
          </IconButton>
        </div>
      ));

  return (
    <Contexto.Provider value={api}>
      {children}
      <div className="avisos">
        <div role="status" aria-live="polite">
          {render("ok")}
        </div>
        <div role="alert" aria-live="assertive">
          {render("error")}
        </div>
      </div>
    </Contexto.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(Contexto);
  if (!api) throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  return api;
}
