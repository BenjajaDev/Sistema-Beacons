import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { NavLink, Outlet, ScrollRestoration, useLocation } from "react-router";
import { TextSizeControl, ThemeSwitcher } from "@shared/theme/Controls";
import { IconoCerrar, IconoMenu } from "@shared/ui/Icons";
import { ToastProvider } from "@shared/ui/Toast";
import { EnlaceEditable, Logo, Redes } from "./components";
import { consultas, PIE_POR_DEFECTO } from "./data";

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

// El pie se edita en el panel (Pie de página): descripción, columnas de enlaces,
// bloques visibles y texto legal. Cada bloque lleva su título, sin ser región.
function Pie() {
  const { data: sitio } = useQuery(consultas.sitio());
  if (!sitio) return null;
  const { telefono, correo, direccion, redes } = sitio.contacto;
  const pie = sitio.pie ?? PIE_POR_DEFECTO;
  const hayContacto = pie.mostrarContacto && Boolean(telefono || correo || direccion);
  const hayRedes = pie.mostrarRedes && redes.length > 0;
  return (
    <footer className="pie">
      <div className="container pie__rejilla">
        <div className="pie__marca">
          <p className="pie__nombre">{sitio.siteName}</p>
          {pie.descripcion && <p className="pie__descripcion">{pie.descripcion}</p>}
          {hayRedes && <Redes redes={redes} etiqueta="Redes sociales" variante="iconos" />}
        </div>
        {pie.columnas.map((col, i) => (
          <div key={i} className="pie__columna">
            <h2 className="pie__titulo">{col.titulo}</h2>
            <ul className="pie__enlaces">
              {col.enlaces.map((e, j) => (
                <li key={j}>
                  <EnlaceEditable href={e.href} className="pie__enlace">
                    {e.texto}
                  </EnlaceEditable>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {hayContacto && (
          <div className="pie__columna">
            <h2 className="pie__titulo">Contacto</h2>
            <ul className="pie__enlaces">
              {telefono && (
                <li>
                  <a href={`tel:${telefono.replace(/[^\d+]/g, "")}`} className="pie__enlace">
                    {telefono}
                  </a>
                </li>
              )}
              {correo && (
                <li>
                  <a href={`mailto:${correo}`} className="pie__enlace">
                    {correo}
                  </a>
                </li>
              )}
              {direccion && <li className="pie__dato">{direccion}</li>}
            </ul>
          </div>
        )}
        {pie.mostrarAccesibilidad && (
          <div className="pie__columna pie__columna--ancha">
            <h2 className="pie__titulo">Accesibilidad</h2>
            <p className="pie__descripcion">{sitio.accesibilidad}</p>
          </div>
        )}
      </div>
      <div className="container pie__legal">
        <p>
          © {new Date().getFullYear()} {sitio.siteName}
          {pie.textoLegal && <>. {pie.textoLegal}</>}
        </p>
      </div>
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
