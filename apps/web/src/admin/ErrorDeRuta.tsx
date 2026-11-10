import { useEffect } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { Button } from "@shared/ui/Button";
import { usePanelPage } from "./ui";

// Error al mostrar una vista del panel. Reemplaza la pantalla genérica de React Router.
//
// El caso más común es «Failed to fetch dynamically imported module»: la vista se
// carga aparte y su archivo cambió (después de un despliegue, o en desarrollo cuando
// Vite vuelve a empaquetar dependencias). Recargar trae la versión nueva, así que se
// recarga sola una vez; si vuelve a fallar, se explica y se ofrece recargar a mano.

const CLAVE_RECARGA = "signal-panel-recarga";

function mensajeDe(error: unknown) {
  if (error instanceof Error) return error.message;
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  return String(error);
}

export function ErrorDeRuta() {
  const error = useRouteError();
  const mensaje = mensajeDe(error);
  const esCarga =
    /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      mensaje,
    );
  const h1 = usePanelPage(esCarga ? "No se pudo cargar" : "Error");

  useEffect(() => {
    if (!esCarga) return;
    try {
      const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0);
      // Una sola recarga automática cada 10 s, para no entrar en un bucle.
      if (Date.now() - ultima > 10_000) {
        sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // Sin sessionStorage: queda el botón para recargar a mano.
    }
  }, [esCarga]);

  return (
    <div className="vista-contenido">
      <h1 ref={h1} tabIndex={-1}>
        {esCarga ? "No se pudo cargar esta parte del panel" : "Algo salió mal en esta vista"}
      </h1>
      <p>
        {esCarga
          ? "Suele pasar cuando el panel se actualizó mientras lo tenías abierto. Recarga la página para traer la versión nueva; no se pierde nada de lo que ya guardaste."
          : "Recarga la página. Si el problema sigue, avisa al equipo técnico con este detalle:"}
      </p>
      {!esCarga && <pre className="detalle-error">{mensaje}</pre>}
      <div className="fila-botones">
        <Button onClick={() => window.location.reload()}>Recargar la página</Button>
        <Link to="/" className="btn btn--secundario">
          Volver al resumen
        </Link>
      </div>
    </div>
  );
}
