import { createBrowserRouter } from "react-router";
import { Layout } from "./Layout";
import Contacto from "./pages/Contacto";
import Inicio from "./pages/Inicio";
import NoEncontrada from "./pages/NoEncontrada";
import Noticia from "./pages/Noticia";
import Noticias from "./pages/Noticias";
import Nosotros from "./pages/Nosotros";

// Las páginas se cargan junto con la app: pesan unos pocos KB en total y cargarlas
// por separado agregaba una segunda descarga en cadena antes del primer render.
export function crearRouter() {
  return createBrowserRouter([
    {
      Component: Layout,
      children: [
        { index: true, Component: Inicio },
        { path: "nosotros", Component: Nosotros },
        { path: "noticias", Component: Noticias },
        { path: "noticias/:slug", Component: Noticia },
        { path: "contacto", Component: Contacto },
        { path: "*", Component: NoEncontrada },
      ],
    },
  ]);
}
