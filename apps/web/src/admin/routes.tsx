import type { ComponentType } from "react";
import { createBrowserRouter, Link, Navigate, Outlet } from "react-router";
import { importarConRecarga } from "@shared/recarga";
import { ToastProvider } from "@shared/ui/Toast";
import type { Rol } from "./api";
import { Shell, SoloRol } from "./Shell";
import { usePanelPage } from "./ui";
import { CambiarContrasena, Login } from "./views/Acceso";
import Bitacora from "./views/Bitacora";
import Contacto from "./views/Contacto";
import Equipo from "./views/Equipo";
import Noticias from "./views/Noticias";
import Perfil from "./views/Perfil";
import Resumen from "./views/Resumen";
import Secciones from "./views/Secciones";
import Usuarios from "./views/Usuarios";

// La ruta del panel no está en el código: sale del <base href> que inyecta Express
// (/<ADMIN_PATH>/). En desarrollo (admin.html servido por Vite) es la raíz.
function basename() {
  const ruta = new URL(document.baseURI).pathname;
  return ruta.endsWith("/") ? ruta.slice(0, -1) : ruta.replace(/\/[^/]*$/, "");
}

// Las vistas con el editor de texto enriquecido (el código más pesado) se cargan al entrar.
// Si el módulo ya no existe (build nuevo), la página se recarga sola: ver @shared/recarga.
type Modulo = () => Promise<{ default: ComponentType }>;
const diferida = (cargar: Modulo) => async () => ({
  Component: (await importarConRecarga(cargar)).default,
});
const diferidaAdmin = (cargar: Modulo) => async () => ({
  element: soloAdmin((await importarConRecarga(cargar)).default),
});

const soloAdmin = (Vista: ComponentType) => {
  const roles: Rol[] = ["ADMIN"];
  return (
    <SoloRol roles={roles}>
      <Vista />
    </SoloRol>
  );
};

function NoEncontrada() {
  const h1 = usePanelPage("Página no encontrada");
  return (
    <div className="vista-contenido">
      <h1 ref={h1} tabIndex={-1}>
        No encontramos esta página del panel
      </h1>
      <p>
        <Link to="/" className="btn btn--primario">
          Volver al resumen
        </Link>
      </p>
    </div>
  );
}

function Raiz() {
  return (
    <ToastProvider>
      <Outlet />
    </ToastProvider>
  );
}

export function crearRouter() {
  return createBrowserRouter(
    [
      {
        Component: Raiz,
        children: [
          { path: "login", Component: Login },
          { path: "cambiar-contrasena", Component: CambiarContrasena },
          { path: "admin.html", element: <Navigate to="/" replace /> },
          {
            Component: Shell,
            children: [
              { index: true, Component: Resumen },
              { path: "noticias", Component: Noticias },
              { path: "noticias/nueva", lazy: diferida(() => import("./views/NoticiaEditor")) },
              { path: "noticias/:id", lazy: diferida(() => import("./views/NoticiaEditor")) },
              {
                path: "noticias/:id/vista-previa",
                lazy: diferida(() => import("./views/NoticiaPreview")),
              },
              { path: "secciones", Component: Secciones },
              { path: "secciones/:key", lazy: diferida(() => import("./views/SeccionEditor")) },
              { path: "equipo", Component: Equipo },
              { path: "identidad", lazy: diferida(() => import("./views/Identidad")) },
              { path: "contacto", element: soloAdmin(Contacto) },
              { path: "pie", lazy: diferida(() => import("./views/Pie")) },
              {
                path: "audiodescriptor",
                lazy: diferida(() => import("./views/Audiodescriptor")),
              },
              { path: "perfil", Component: Perfil },
              {
                path: "beacons",
                lazy: diferidaAdmin(() => import("./views/Beacons")),
              },
              { path: "usuarios", element: soloAdmin(Usuarios) },
              { path: "bitacora", element: soloAdmin(Bitacora) },
              { path: "*", Component: NoEncontrada },
            ],
          },
        ],
      },
    ],
    { basename: basename() },
  );
}
