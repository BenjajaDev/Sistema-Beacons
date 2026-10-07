import type { ComponentType } from "react";
import { createBrowserRouter, Link, Navigate, Outlet } from "react-router";
import { ToastProvider } from "@shared/ui/Toast";
import type { Rol } from "./api";
import { ErrorDeRuta } from "./ErrorDeRuta";
import { CONTENIDO, Shell, SoloRol } from "./Shell";
import { usePanelPage } from "./ui";
import { CambiarContrasena, Login } from "./views/Acceso";
import Bitacora from "./views/Bitacora";
import Contacto, { ContactoYRedes } from "./views/Contacto";
import Equipo from "./views/Equipo";
import Noticias from "./views/Noticias";
import Perfil from "./views/Perfil";
import Resumen from "./views/Resumen";
import Secciones from "./views/Secciones";
import Usuarios from "./views/Usuarios";

// La ruta del panel no está en el código: sale del <base href> que inyecta Express
// (/<ADMIN_PATH>/). En desarrollo (admin.html servido por Vite) es la raíz.
function basename() {
  // Sin <base> (desarrollo con Vite) el panel vive en la raíz. Calcularla desde la URL
  // actual fallaba al recargar una ruta interna como /secciones/hero.
  if (!document.querySelector("base[href]")) return "";
  return new URL(document.baseURI).pathname.replace(/\/$/, "");
}

// Las vistas con el editor de texto enriquecido (el código más pesado) se cargan al entrar.
const diferida = (cargar: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await cargar()).default,
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
        errorElement: <ErrorDeRuta />,
        children: [
          { path: "login", Component: Login },
          { path: "cambiar-contrasena", Component: CambiarContrasena },
          { path: "admin.html", element: <Navigate to="/" replace /> },
          {
            Component: Shell,
            children: [
              {
                // Si una vista falla, el error se muestra dentro del panel, sin perder el menú.
                errorElement: <ErrorDeRuta />,
                children: [
                  { index: true, Component: Resumen },
                  {
                    // Contenido del sitio: edición y administración (no comunicación).
                    element: (
                      <SoloRol roles={CONTENIDO}>
                        <Outlet />
                      </SoloRol>
                    ),
                    children: [
                      { path: "noticias", Component: Noticias },
                      {
                        path: "noticias/nueva",
                        lazy: diferida(() => import("./views/NoticiaEditor")),
                      },
                      {
                        path: "noticias/:id",
                        lazy: diferida(() => import("./views/NoticiaEditor")),
                      },
                      {
                        path: "noticias/:id/vista-previa",
                        lazy: diferida(() => import("./views/NoticiaPreview")),
                      },
                      { path: "secciones", Component: Secciones },
                      {
                        path: "secciones/:key",
                        lazy: diferida(() => import("./views/SeccionEditor")),
                      },
                      { path: "equipo", Component: Equipo },
                      { path: "identidad", lazy: diferida(() => import("./views/Identidad")) },
                      { path: "pie", lazy: diferida(() => import("./views/Pie")) },
                    ],
                  },
                  { path: "contacto", Component: Contacto },
                  { path: "redes", Component: ContactoYRedes },
                  { path: "perfil", Component: Perfil },
                  {
                    path: "beacons",
                    lazy: async () => ({
                      element: soloAdmin((await import("./views/Beacons")).default),
                    }),
                  },
                  { path: "usuarios", element: soloAdmin(Usuarios) },
                  { path: "bitacora", element: soloAdmin(Bitacora) },
                  { path: "*", Component: NoEncontrada },
                ],
              },
            ],
          },
        ],
      },
    ],
    { basename: basename() },
  );
}
