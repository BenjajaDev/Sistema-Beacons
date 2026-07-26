// Lista de beacons existentes con acciones de editar/borrar.
export default function BeaconList({ beacons, seleccionado, onEditar, onBorrar }) {
  const claves = Object.keys(beacons).sort();

  if (claves.length === 0) {
    return <p className="muted">No hay beacons todavía. Crea el primero con “+ Nuevo beacon”.</p>;
  }

  return (
    <ul className="lista">
      {claves.map((clave) => {
        const info = beacons[clave];
        const activo = clave === seleccionado;
        return (
          <li key={clave} className={`lista__item ${activo ? "lista__item--activo" : ""}`}>
            <button className="lista__main" onClick={() => onEditar(clave)} title="Editar">
              <span className="lista__clave">{clave}</span>
              <span className="lista__titulo">{info.titulo || "(sin título)"}</span>
              {info.ubicacion && <span className="lista__ubic">{info.ubicacion}</span>}
            </button>
            <button
              className="btn btn--peligro btn--sm"
              onClick={() => onBorrar(clave)}
              title="Borrar"
            >
              🗑
            </button>
          </li>
        );
      })}
    </ul>
  );
}
