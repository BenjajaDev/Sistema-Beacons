import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { NavLink, Outlet, ScrollRestoration, useLocation } from "react-router";
import { TextSizeControl, ThemeSwitcher } from "@shared/theme/Controls";
import { IconoCerrar, IconoMenu } from "@shared/ui/Icons";
import { ToastProvider } from "@shared/ui/Toast";
import { Logo, Redes } from "./components";
import { consultas } from "./data";

const NAVEGACION = [
  { to: "/", texto: "Inicio", end: true },
  { to: "/nosotros", texto: "Nosotros" },
  { to: "/noticias", texto: "Noticias" },
  { to: "/contacto", texto: "Contacto" },
];

function suscribirConexion(aviso: () => void) {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
}

function useEnLinea() {
  return useSyncExternalStore(
    suscribirConexion,
    () => navigator.onLine,
    () => true,
  );
}

function Encabezado() {
  const { data: sitio } = useQuery(consultas.sitio());
  const menuId = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  // Se guarda la ruta en que se abrió el menú: al navegar a otra, queda cerrado
  // sin necesidad de un efecto.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === pathname;

  // Escape cierra el menú y devuelve el foco al botón.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbiertoEn(null);
        boton.current?.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  return (
    <header className="encabezado">
      <div className="container encabezado__fila">
        <Logo sitio={sitio} />
        <button
          ref={boton}
          type="button"
          className="icon-btn encabezado__menu-boton"
          aria-expanded={abierto}
          aria-controls={menuId}
          onClick={() => setAbiertoEn(abierto ? null : pathname)}
        >
          {abierto ? <IconoCerrar /> : <IconoMenu />}
          <span className="visually-hidden">Menú</span>
        </button>
        <div
          id={menuId}
          className={`encabezado__menu ${abierto ? "encabezado__menu--abierto" : ""}`}
        >
          <nav aria-label="Principal">
            <ul className="navegacion">
              {NAVEGACION.map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} end={n.end}>
                    {n.texto}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="encabezado__ajustes">
            <TextSizeControl />
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}

function Pie() {
  const { data: sitio } = useQuery(consultas.sitio());
  if (!sitio) return null;
  const { telefono, correo, direccion, redes } = sitio.contacto;
  return (
    <footer className="pie">
      <div className="container pie__rejilla">
        {/* Bloques con título, sin ser regiones: «Contacto» ya es una región en su página. */}
        <div>
          <h2 id="pie-contacto" className="pie__titulo">
            Contacto
          </h2>
          <ul className="pie__lista">
            {telefono && (
              <li>
                <a href={`tel:${telefono.replace(/[^\d+]/g, "")}`}>{telefono}</a>
              </li>
            )}
            {correo && (
              <li>
                <a href={`mailto:${correo}`}>{correo}</a>
              </li>
            )}
            {direccion && <li>{direccion}</li>}
          </ul>
          <Redes redes={redes} etiqueta="Redes sociales" />
        </div>
        <div>
          <h2 id="pie-accesibilidad" className="pie__titulo">
            Accesibilidad
          </h2>
          <p>{sitio.accesibilidad}</p>
        </div>
      </div>
      <p className="container pie__legal">
        © {new Date().getFullYear()} {sitio.siteName}
      </p>
    </footer>
  );
}

export function Layout() {
  const enLinea = useEnLinea();
  return (
    <ToastProvider>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <Encabezado />
      <div role="status" className={enLinea ? "visually-hidden" : "aviso-conexion"}>
        {enLinea ? "" : "Sin conexión: estás viendo el contenido guardado en este dispositivo."}
      </div>
      <main id="contenido" tabIndex={-1}>
        <Outlet />
      </main>
      <Pie />
      <ScrollRestoration />
    </ToastProvider>
  );
}
