import logotipo from "../assets/LOGOTIPO.png";
import isotipo from "../assets/ISOTIPO.png";
import { IconoResumen, IconoBeacon } from "./Iconos.jsx";

const SECCIONES = [
  { id: "resumen", etiqueta: "Resumen", Icono: IconoResumen },
  { id: "beacons", etiqueta: "Beacons", Icono: IconoBeacon },
];

// Navegación lateral del panel: marca arriba, secciones en medio, firma abajo.
export default function Sidebar({ vista, onVista, total }) {
  return (
    <aside className="side">
      <div className="side__marca">
        <img src={logotipo} alt="Proyecto Signal" className="side__logo" />
      </div>

      <p className="side__etiqueta">Panel</p>
      <nav className="nav" aria-label="Secciones del panel">
        {SECCIONES.map(({ id, etiqueta, Icono }) => (
          <button
            key={id}
            className={`nav__item ${vista === id ? "nav__item--activo" : ""}`}
            onClick={() => onVista(id)}
            aria-current={vista === id ? "page" : undefined}
          >
            <Icono />
            {etiqueta}
            {id === "beacons" && <span className="nav__contador">{total}</span>}
          </button>
        ))}
      </nav>

      <div className="side__pie">
        <img src={isotipo} alt="" className="side__iso" />
        <span>
          Proyecto Signal
          <br />
          Sistema de Beacons
        </span>
      </div>
    </aside>
  );
}