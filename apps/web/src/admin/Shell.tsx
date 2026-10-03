import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { usePage } from "@shared/a11y/focus";
import { mensajeDeError } from "@shared/api";
import { TextSizeControl, ThemeSwitcher } from "@shared/theme/Controls";
import { Button, IconButton } from "@shared/ui/Button";
import { IconoCerrar, IconoMenu } from "@shared/ui/Icons";
import { useToast } from "@shared/ui/Toast";
import { adminFetch, type Rol } from "./api";
import { useAuth } from "./auth";

interface ItemMenu {
  to: string;
  texto: string;
  roles: Rol[];
  end?: boolean;
}

export const MENU: ItemMenu[] = [
  { to: "/", texto: "Resumen", roles: ["ADMIN", "EDITOR"], end: true },
  { to: "/noticias", texto: "Noticias", roles: ["ADMIN", "EDITOR"] },
  { to: "/secciones", texto: "Secciones", roles: ["ADMIN", "EDITOR"] },
  { to: "/equipo", texto: "Equipo", roles: ["ADMIN"] },
  { to: "/identidad", texto: "Identidad visual", roles: ["ADMIN"] },
  { to: "/contacto", texto: "Contacto", roles: ["ADMIN"] },
  { to: "/beacons", texto: "Beacons", roles: ["ADMIN"] },
  { to: "/usuarios", texto: "Usuarios", roles: ["ADMIN"] },
  { to: "/bitacora", texto: "Bitácora", roles: ["ADMIN"] },
];

const ESCRITORIO = "(min-width: 64rem)";
function useEsEscritorio() {
  return useSyncExternalStore(
    (aviso) => {
      const mq = window.matchMedia(ESCRITORIO);
      mq.addEventListener("change", aviso);
      return () => mq.removeEventListener("change", aviso);
    },
    () => window.matchMedia(ESCRITORIO).matches,
    () => true,
  );
}

function Navegacion() {
  const { tiene } = useAuth();
  const { data } = useQuery({
    queryKey: ["admin", "mensajes", "no-leidos"],
    queryFn: () => adminFetch<{ noLeidos: number }>("/messages?limit=1&noLeidos=true"),
    enabled: tiene("ADMIN"),
    staleTime: 60_000,
  });
  return (
    <nav aria-label="Panel" className="panel-nav">
      <ul>
        {MENU.filter((m) => tiene(...m.roles)).map((m) => (
          <li key={m.to}>
            <NavLink to={m.to} end={m.end}>
              {m.texto}
              {m.to === "/contacto" && data && data.noLeidos > 0 && (
                <span className="contador">
                  {data.noLeidos}
                  <span className="visually-hidden"> mensajes sin leer</span>
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// En móvil el menú es un cajón modal: atrapa el foco y se cierra con Escape.
function Cajon({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  // Navegar cierra el cajón.
  useEffect(() => {
    if (ref.current?.open) ref.current.close();
  }, [pathname]);

  return (
    <dialog ref={ref} className="cajon" aria-label="Menú del panel" onClose={onCerrar}>
      <div className="cajon__cabecera">
        <span className="panel-marca">SIGNAL · Panel</span>
        <IconButton label="Cerrar menú" onClick={() => ref.current?.close()}>
          <IconoCerrar />
        </IconButton>
      </div>
      <Navegacion />
    </dialog>
  );
}

function BarraSuperior({ onAbrirMenu }: { onAbrirMenu?: () => void }) {
  const { usuario, cerrarSesion } = useAuth();
  const toast = useToast();
  return (
    <header className="panel-barra">
      {onAbrirMenu && (
        <IconButton label="Abrir menú" onClick={onAbrirMenu}>
          <IconoMenu />
        </IconButton>
      )}
      <a href="/" className="panel-barra__sitio" target="_blank" rel="noopener">
        Ver el sitio<span className="visually-hidden"> (se abre en otra pestaña)</span>
      </a>
      <div className="panel-barra__ajustes">
        <TextSizeControl />
        <ThemeSwitcher />
      </div>
      <div className="panel-barra__cuenta">
        <span>
          {usuario?.name}{" "}
          <span className="insignia">
            {usuario?.role === "ADMIN" ? "Administración" : "Edición"}
          </span>
        </span>
        <Link to="/cambiar-contrasena">Cambiar contraseña</Link>
        <Button
          variante="secundario"
          onClick={() =>
            cerrarSesion().catch((err) =>
              toast.error(`No se pudo cerrar la sesión. ${mensajeDeError(err)}`),
            )
          }
        >
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
}

export function Shell() {
  const { usuario, cargando } = useAuth();
  const escritorio = useEsEscritorio();
  const location = useLocation();
  const [cajonAbierto, setCajonAbierto] = useState(false);

  if (cargando) {
    return (
      <p role="status" className="panel-cargando">
        Cargando el panel…
      </p>
    );
  }
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  if (usuario.mustChangePassword) return <Navigate to="/cambiar-contrasena" replace />;

  return (
    <div className="panel">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      {escritorio ? (
        <aside className="panel-lateral">
          <span className="panel-marca">SIGNAL · Panel</span>
          <Navegacion />
        </aside>
      ) : (
        <Cajon abierto={cajonAbierto} onCerrar={() => setCajonAbierto(false)} />
      )}
      <div className="panel-cuerpo">
        <BarraSuperior onAbrirMenu={escritorio ? undefined : () => setCajonAbierto(true)} />
        {/* La clave fuerza la transición de entrada en cada cambio de vista. */}
        <main id="contenido" tabIndex={-1} className="vista" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Las rutas solo de administración se protegen también aquí: si un editor llega
// por URL ve un aviso (y la API respondería 403 de todos modos).
export function SoloRol({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { tiene } = useAuth();
  if (tiene(...roles)) return <>{children}</>;
  return <SinAcceso />;
}

function SinAcceso() {
  const h1 = usePage("Sin acceso", "Panel SIGNAL");
  return (
    <div className="vista-contenido">
      <h1 ref={h1} tabIndex={-1}>
        No tienes acceso a esta sección
      </h1>
      <p>
        Esta parte del panel es solo para administración. Si necesitas cambiar algo aquí, pídeselo a
        una persona administradora.
      </p>
      <p>
        <Link to="/" className="btn btn--primario">
          Volver al resumen
        </Link>
      </p>
    </div>
  );
}
