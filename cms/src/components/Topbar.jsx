import { IconoBuscar, IconoRecargar, IconoMas, IconoSol, IconoLuna } from "./Iconos.jsx";

// Cabecera fija: título de la vista, buscador (sólo en la lista),
// recarga, alta rápida y conmutador de tema.
export default function Topbar({
  titulo,
  subtitulo,
  busqueda,
  onBuscar,
  mostrarBuscador,
  onRecargar,
  onNuevo,
  cargando,
  tema,
  onTema,
}) {
  const oscuro = tema === "oscuro";

  return (
    <header className="topbar">
      <div className="topbar__titulos">
        <h1>{titulo}</h1>
        <p>{subtitulo}</p>
      </div>

      <div className="topbar__acciones">
        {mostrarBuscador && (
          <div className="buscador">
            <IconoBuscar />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => onBuscar(e.target.value)}
              placeholder="Buscar por clave, título o ubicación…"
              aria-label="Buscar beacons"
            />
          </div>
        )}

        <button
          className="btn btn--icono"
          onClick={onRecargar}
          disabled={cargando}
          title="Recargar datos"
          aria-label="Recargar datos"
        >
          <IconoRecargar className={cargando ? "girando" : undefined} />
        </button>

        <button
          className="btn btn--icono"
          onClick={onTema}
          title={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-pressed={oscuro}
        >
          <span className="topbar__temaicono" key={tema}>
            {oscuro ? <IconoSol /> : <IconoLuna />}
          </span>
        </button>

        <button className="btn btn--primary" onClick={onNuevo}>
          <IconoMas size={16} />
          Nuevo beacon
        </button>
      </div>
    </header>
  );
}