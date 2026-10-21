import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ApiError, mensajeDeError } from "@shared/api";
import { TextSizeControl, ThemeSwitcher } from "@shared/theme/Controls";
import { Button } from "@shared/ui/Button";
import { ErrorSummary, type ErrorDeCampo } from "@shared/ui/ErrorSummary";
import { TextField } from "@shared/ui/Field";
import { useToast } from "@shared/ui/Toast";
import { useAuth } from "../auth";
import { usePanelPage } from "../ui";

function MarcoAcceso({ children }: { children: React.ReactNode }) {
  return (
    <div className="acceso">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="acceso__barra">
        <span className="panel-marca">SIGNAL · Panel</span>
        <div className="panel-barra__ajustes">
          <TextSizeControl />
          <ThemeSwitcher />
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="acceso__tarjeta">
        {children}
      </main>
    </div>
  );
}

// Campo de contraseña con botón para mostrarla (ayuda a quien escribe con lector
// de pantalla, con baja visión o con temblor en las manos).
function CampoClave({
  id,
  label,
  valor,
  onCambiar,
  autoComplete,
  error,
  ayuda,
}: {
  id: string;
  label: string;
  valor: string;
  onCambiar: (v: string) => void;
  autoComplete: string;
  error?: string;
  ayuda?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="campo-clave">
      <TextField
        id={id}
        label={label}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        error={error}
        ayuda={ayuda}
        spellCheck={false}
      />
      <button
        type="button"
        className="btn btn--fantasma campo-clave__mostrar"
        aria-pressed={visible}
        aria-controls={id}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? "Ocultar" : "Mostrar"}
        <span className="visually-hidden"> {label.toLowerCase()}</span>
      </button>
    </div>
  );
}

export function Login() {
  const { usuario, aviso, iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const h1 = usePanelPage("Iniciar sesión");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<ErrorDeCampo[]>([]);
  const [general, setGeneral] = useState<string | null>(null);
  const generalRef = useRef<HTMLParagraphElement>(null);

  if (usuario)
    return <Navigate to={usuario.mustChangePassword ? "/cambiar-contrasena" : "/"} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const faltan: ErrorDeCampo[] = [];
    if (!email.trim()) faltan.push({ campoId: "login-email", mensaje: "Escribe tu correo." });
    if (!clave) faltan.push({ campoId: "login-clave", mensaje: "Escribe tu contraseña." });
    setErrores(faltan);
    setGeneral(null);
    if (faltan.length) return;

    setEnviando(true);
    try {
      const u = await iniciarSesion(email, clave);
      const desde = (location.state as { desde?: string } | null)?.desde;
      navigate(u.mustChangePassword ? "/cambiar-contrasena" : (desde ?? "/"), { replace: true });
    } catch (err) {
      setClave("");
      setGeneral(
        err instanceof ApiError && err.status === 0
          ? mensajeDeError(err)
          : err instanceof ApiError
            ? err.message
            : "No se pudo iniciar sesión. Intenta de nuevo.",
      );
      // Foco al mensaje para que se anuncie y se lea primero.
      requestAnimationFrame(() => generalRef.current?.focus());
    } finally {
      setEnviando(false);
    }
  }

  const errorDe = (id: string) => errores.find((x) => x.campoId === id)?.mensaje;

  return (
    <MarcoAcceso>
      <h1 ref={h1} tabIndex={-1}>
        Iniciar sesión
      </h1>
      {aviso && (
        <p className="aviso-panel aviso-panel--info" role="status">
          {aviso}
        </p>
      )}
      {general && (
        <p className="aviso-panel aviso-panel--error" role="alert" tabIndex={-1} ref={generalRef}>
          {general}
        </p>
      )}
      <ErrorSummary errores={errores} />
      <form onSubmit={enviar} noValidate>
        <TextField
          id="login-email"
          label="Correo"
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errorDe("login-email")}
        />
        <CampoClave
          id="login-clave"
          label="Contraseña"
          valor={clave}
          onCambiar={setClave}
          autoComplete="current-password"
          error={errorDe("login-clave")}
        />
        <Button type="submit" cargando={enviando} textoCargando="Entrando…" className="btn--ancho">
          Entrar
        </Button>
      </form>
      <p className="acceso__nota">
        ¿Olvidaste tu contraseña? Pide a una persona administradora que la restablezca desde
        «Usuarios».
      </p>
    </MarcoAcceso>
  );
}

export function CambiarContrasena() {
  const { usuario, cambiarContrasena } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const h1 = usePanelPage("Cambiar contraseña");
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [errores, setErrores] = useState<ErrorDeCampo[]>([]);
  const [enviando, setEnviando] = useState(false);

  if (!usuario) return <Navigate to="/login" replace />;
  const obligatorio = usuario.mustChangePassword;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const faltan: ErrorDeCampo[] = [];
    if (!actual) faltan.push({ campoId: "clave-actual", mensaje: "Escribe tu contraseña actual." });
    if (nueva.length < 12)
      faltan.push({
        campoId: "clave-nueva",
        mensaje: "La nueva contraseña debe tener al menos 12 caracteres.",
      });
    else if (nueva === actual)
      faltan.push({
        campoId: "clave-nueva",
        mensaje: "La nueva contraseña debe ser distinta de la actual.",
      });
    if (repetir !== nueva)
      faltan.push({
        campoId: "clave-repetir",
        mensaje: "Las dos contraseñas nuevas no coinciden.",
      });
    setErrores(faltan);
    if (faltan.length) return;

    setEnviando(true);
    try {
      await cambiarContrasena(actual, nueva);
      toast.exito("Contraseña actualizada. Se cerraron tus otras sesiones abiertas.");
      navigate("/", { replace: true });
    } catch (err) {
      const campos = err instanceof ApiError ? err.campos : {};
      const ids: Record<string, string> = {
        currentPassword: "clave-actual",
        newPassword: "clave-nueva",
      };
      const delServidor = Object.entries(campos).map(([c, m]) => ({
        campoId: ids[c] ?? "clave-nueva",
        mensaje: m,
      }));
      if (delServidor.length) setErrores(delServidor);
      else toast.error(`No se pudo cambiar la contraseña. ${mensajeDeError(err)}`);
    } finally {
      setEnviando(false);
    }
  }

  const errorDe = (id: string) => errores.find((x) => x.campoId === id)?.mensaje;

  return (
    <MarcoAcceso>
      <h1 ref={h1} tabIndex={-1}>
        {obligatorio ? "Crea tu contraseña" : "Cambiar contraseña"}
      </h1>
      {obligatorio && (
        <p className="aviso-panel aviso-panel--info">
          Hola, {usuario.name}. Antes de entrar al panel, cambia la contraseña temporal por una
          tuya.
        </p>
      )}
      <ErrorSummary errores={errores} />
      <form onSubmit={enviar} noValidate>
        <CampoClave
          id="clave-actual"
          label={obligatorio ? "Contraseña temporal" : "Contraseña actual"}
          valor={actual}
          onCambiar={setActual}
          autoComplete="current-password"
          error={errorDe("clave-actual")}
        />
        <CampoClave
          id="clave-nueva"
          label="Nueva contraseña"
          valor={nueva}
          onCambiar={setNueva}
          autoComplete="new-password"
          error={errorDe("clave-nueva")}
          ayuda="Al menos 12 caracteres, distinta de la actual y sin tu correo. Una frase larga es fácil de recordar y difícil de adivinar."
        />
        <CampoClave
          id="clave-repetir"
          label="Repite la nueva contraseña"
          valor={repetir}
          onCambiar={setRepetir}
          autoComplete="new-password"
          error={errorDe("clave-repetir")}
        />
        <Button type="submit" cargando={enviando} textoCargando="Guardando…" className="btn--ancho">
          Guardar contraseña
        </Button>
      </form>
      {!obligatorio && (
        <p className="acceso__nota">
          <Link to="/">Volver al panel sin cambiarla</Link>
        </p>
      )}
    </MarcoAcceso>
  );
}
