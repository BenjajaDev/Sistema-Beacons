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

interface GrupoMenu {
  titulo: string;
  items: ItemMenu[];
}

const TODOS: Rol[] = ["ADMIN", "EDITOR"];
const ADMIN: Rol[] = ["ADMIN"];

// El panel se ordena en cinco secciones. Un grupo de un solo enlace se muestra
// como enlace directo; los demás, con su título y su lista.
export const MENU: GrupoMenu[] = [
  { titulo: "Resumen", items: [{ to: "/", texto: "Resumen", roles: TODOS, end: true }] },
  {
    titulo: "Contenido",
    items: [
      { to: "/secciones", texto: "Secciones", roles: TODOS },
      { to: "/noticias", texto: "Noticias", roles: TODOS },
      { to: "/equipo", texto: "Equipo y colaboradores", roles: ADMIN },
    ],
  },
  {
    titulo: "CMS",
    items: [
      { to: "/identidad", texto: "Identidad visual", roles: ADMIN },
      { to: "/pie", texto: "Pie de página", roles: ADMIN },
      { to: "/contacto", texto: "Mensajes", roles: ADMIN },
      { to: "/beacons", texto: "Beacons", roles: ADMIN },
    ],
  },
  { titulo: "Usuarios", items: [{ to: "/usuarios", texto: "Usuarios", roles: ADMIN }] },
  { titulo: "Bitácora", items: [{ to: "/bitacora", texto: "Bitácora", roles: ADMIN }] },
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
  const enlace = (m: ItemMenu) => (
    <NavLink to={m.to} end={m.end} className="panel-nav__enlace">
      {m.texto}
      {m.to === "/contacto" && data && data.noLeidos > 0 && (
        <span className="contador">
          {data.noLeidos}
          <span className="visually-hidden"> mensajes sin leer</span>
        </span>
      )}
    </NavLink>
  );
  return (
    <nav aria-label="Panel" className="panel-nav">
      <ul>
        {MENU.map((g) => {
          const items = g.items.filter((m) => tiene(...m.roles));
          if (!items.length) return null;
          if (g.items.length === 1) return <li key={g.titulo}>{enlace(items[0]!)}</li>;
          const idGrupo = `menu-${g.titulo.toLowerCase()}`;
          return (
            <li key={g.titulo} className="panel-nav__grupo">
              <span id={idGrupo} className="panel-nav__titulo">
                {g.titulo}
              </span>
              <ul aria-labelledby={idGrupo}>
                {items.map((m) => (
                  <li key={m.to}>{enlace(m)}</li>
                ))}
              </ul>
            </li>
          );
        })}
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
      <a href="/" className="btn btn--fantasma panel-barra__sitio" target="_blank" rel="noopener">
        Ver el sitio<span className="visually-hidden"> (se abre en otra pestaña)</span>
      </a>
      <div className="panel-barra__ajustes">
        <TextSizeControl />
        <ThemeSwitcher />
      </div>
      <div className="panel-barra__cuenta">
        <Link to="/perfil" className="perfil-chip">
          <span className="perfil-chip__inicial" aria-hidden="true">
            {usuario?.name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="perfil-chip__texto">
            <span className="perfil-chip__nombre">{usuario?.name}</span>
            <span className="perfil-chip__rol">
              {usuario?.role === "ADMIN" ? "Administración" : "Edición"}
            </span>
          </span>
          <span className="visually-hidden">: ver mi perfil</span>
        </Link>
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
