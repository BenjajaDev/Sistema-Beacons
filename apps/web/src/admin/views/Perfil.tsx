import { useState } from "react";
import { Link } from "react-router";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { ErrorSummary } from "@shared/ui/ErrorSummary";
import { TextField } from "@shared/ui/Field";
import { useToast } from "@shared/ui/Toast";
import { useAuth } from "../auth";
import { Cabecera, usePanelPage } from "../ui";

// Accesos para configurar el sitio (solo administración).
const CONFIGURAR = [
  { to: "/identidad", titulo: "Identidad visual", texto: "Nombre, logos, colores y tipografías." },
  { to: "/pie", titulo: "Pie de página", texto: "Textos, enlaces, contacto y redes." },
  { to: "/secciones", titulo: "Secciones", texto: "Qué muestra cada página y en qué orden." },
  { to: "/usuarios", titulo: "Usuarios", texto: "Cuentas, roles y accesos al panel." },
];

export default function Perfil() {
  const h1 = usePanelPage("Mi perfil");
  const { usuario, actualizarPerfil, tiene } = useAuth();
  const toast = useToast();
  const [nombre, setNombre] = useState(usuario?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const sucio = nombre.trim() !== usuario?.name;

  async function guardar() {
    if (!nombre.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    setGuardando(true);
    try {
      await actualizarPerfil({ name: nombre.trim() });
      setError(null);
      toast.exito("Perfil guardado.");
    } catch (err) {
      if (err instanceof ApiError && err.campos.name) setError(err.campos.name);
      else toast.error(`No se pudo guardar. ${mensajeDeError(err)}`);
    } finally {
      setGuardando(false);
    }
  }

  if (!usuario) return null;
  const esAdmin = tiene("ADMIN");
  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Mi perfil"
        descripcion="Tus datos en el panel y la seguridad de tu cuenta."
      />

      <section className="tarjeta-panel perfil" aria-labelledby="perfil-datos">
        <div className="perfil__avatar" aria-hidden="true">
          {usuario.name.trim().charAt(0).toUpperCase()}
        </div>
        <div className="perfil__datos">
          <h2 id="perfil-datos">Datos de la cuenta</h2>
          <ErrorSummary errores={error ? [{ campoId: "perfil-nombre", mensaje: error }] : []} />
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
          >
            <TextField
              id="perfil-nombre"
              label="Nombre"
              ayuda="Así te ven las demás personas del panel y en la bitácora."
              maxLength={80}
              autoComplete="name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              error={error ?? undefined}
            />
            <dl className="perfil__ficha">
              <div>
                <dt>Correo</dt>
                <dd>{usuario.email}</dd>
              </div>
              <div>
                <dt>Rol</dt>
                <dd>
                  <span className="insignia">{esAdmin ? "Administración" : "Edición"}</span>
                </dd>
              </div>
            </dl>
            <p className="campo__ayuda">
              El correo y el rol los cambia una persona administradora desde «Usuarios».
            </p>
            <Button type="submit" cargando={guardando} textoCargando="Guardando…">
              {sucio ? "Guardar perfil" : "Sin cambios por guardar"}
            </Button>
          </form>
        </div>
      </section>

      <section className="tarjeta-panel" aria-labelledby="perfil-seguridad">
        <h2 id="perfil-seguridad">Seguridad</h2>
        <p>
          Al cambiar tu contraseña se cierran tus sesiones abiertas en otros dispositivos. El tema
          de colores y el tamaño de letra se ajustan arriba a la derecha y se recuerdan en este
          navegador.
        </p>
        <Link to="/cambiar-contrasena" className="btn btn--secundario">
          Cambiar contraseña
        </Link>
      </section>

      {esAdmin && (
        <section className="tarjeta-panel" aria-labelledby="perfil-sitio">
          <h2 id="perfil-sitio">Configurar el sitio</h2>
          <ul className="accesos">
            {CONFIGURAR.map((a) => (
              <li key={a.to}>
                <Link to={a.to} className="acceso-rapido">
                  <span className="acceso-rapido__titulo">{a.titulo}</span>
                  <span className="acceso-rapido__texto">{a.texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
