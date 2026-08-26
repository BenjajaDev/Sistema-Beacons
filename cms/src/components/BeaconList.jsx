import { IconoBorrar, IconoEditar, IconoOk, IconoAlerta } from "./Iconos.jsx";
import { estaCompleto } from "../beacons.js";

// Tabla de beacons con búsqueda, selección y acciones de editar/borrar.
export default function BeaconList({ beacons, seleccionado, busqueda = "", onEditar, onBorrar }) {
  const termino = busqueda.trim().toLowerCase();

  const filas = Object.keys(beacons)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((clave) => ({ clave, info: beacons[clave] }))
    .filter(({ clave, info }) => {
      if (!termino) return true;
      const texto = [clave, info?.titulo, info?.descripcion, info?.ubicacion]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return texto.includes(termino);
    });

  if (Object.keys(beacons).length === 0) {
    return <p className="vacio">No hay beacons todavía. Crea el primero con “Nuevo beacon”.</p>;
  }
  if (filas.length === 0) {
    return <p className="vacio">Ningún beacon coincide con “{busqueda.trim()}”.</p>;
  }

  return (
    <div className="tabla-wrap">
      <table className="tabla">
        <thead>
          <tr>
            <th>Clave</th>
            <th>Beacon</th>
            <th>Ubicación</th>
            <th>Estado</th>
            <th className="tabla__acciones">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ clave, info }) => {
            const completo = estaCompleto(info);
            const activo = clave === seleccionado;
            return (
              <tr
                key={clave}
                className={activo ? "fila--activa" : ""}
                onClick={() => onEditar(clave)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEditar(clave);
                  }
                }}
                tabIndex={0}
                title={`Editar ${clave}`}
              >
                <td>
                  <span className="clave">{clave}</span>
                </td>
                <td>
                  <span className="celda-titulo">{info.titulo?.trim() || "(sin título)"}</span>
                  {info.descripcion?.trim() && (
                    <span className="celda-sub">{info.descripcion}</span>
                  )}
                </td>
                <td className="muted">{info.ubicacion?.trim() || "—"}</td>
                <td>
                  <span className={`badge ${completo ? "badge--ok" : "badge--aviso"}`}>
                    {completo ? <IconoOk size={14} /> : <IconoAlerta size={14} />}
                    {completo ? "Completo" : "Incompleto"}
                  </span>
                </td>
                <td className="tabla__acciones">
                  <button
                    className="btn btn--fantasma"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditar(clave);
                    }}
                    title={`Editar ${clave}`}
                    aria-label={`Editar ${clave}`}
                  >
                    <IconoEditar />
                  </button>
                  <button
                    className="btn btn--peligro"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBorrar(clave);
                    }}
                    title={`Borrar ${clave}`}
                    aria-label={`Borrar ${clave}`}
                  >
                    <IconoBorrar />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}