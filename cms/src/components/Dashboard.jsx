import { useMemo } from "react";
import {
  IconoBeacon,
  IconoUbicacion,
  IconoAlerta,
  IconoOk,
  IconoServidor,
} from "./Iconos.jsx";
import { estaCompleto } from "../beacons.js";

const SIN_UBICACION = "Sin ubicación";

function Kpi({ Icono, tono = "", etiqueta, valor, nota, valorTexto = false }) {
  return (
    <article className="kpi">
      <div className="kpi__top">
        <span className={`kpi__icono ${tono}`}>
          <Icono size={17} />
        </span>
        {etiqueta}
      </div>
      <div className={`kpi__valor ${valorTexto ? "kpi__valor--texto" : ""}`}>{valor}</div>
      <div className="kpi__nota">{nota}</div>
    </article>
  );
}

function EsqueletoKpis() {
  return (
    <section className="kpis anim-entra">
      {Array.from({ length: 4 }).map((_, i) => (
        <article className="kpi kpi--esqueleto" key={i}>
          <div className="esqueleto esqueleto--icono" />
          <div className="esqueleto esqueleto--linea" style={{ width: "55%" }} />
          <div className="esqueleto esqueleto--linea" style={{ width: "80%" }} />
        </article>
      ))}
    </section>
  );
}

// Vista de resumen: fila de KPIs, reparto por ubicación y revisión de contenido.
export default function Dashboard({ beacons, cargando, hayConexion, onEditar, onVerTodos }) {
  const datos = useMemo(() => {
    const entradas = Object.entries(beacons);
    const majors = new Set();
    const porUbicacion = new Map();
    let sinUbicacion = 0;
    let incompletos = 0;

    for (const [clave, info] of entradas) {
      majors.add(clave.split("-")[0]);

      const ubic = info?.ubicacion?.trim();
      if (ubic) {
        porUbicacion.set(ubic, (porUbicacion.get(ubic) || 0) + 1);
      } else {
        sinUbicacion += 1;
      }

      if (!estaCompleto(info)) incompletos += 1;
    }

    const barras = [...porUbicacion.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (sinUbicacion > 0) barras.push([SIN_UBICACION, sinUbicacion]);

    return {
      total: entradas.length,
      majors: majors.size,
      ubicaciones: porUbicacion.size,
      sinUbicacion,
      incompletos,
      barras,
      maximo: barras.reduce((m, [, n]) => Math.max(m, n), 0),
      revision: entradas
        .map(([clave, info]) => ({ clave, info }))
        .sort((a, b) => {
          // Primero lo que falta por completar; luego por clave.
          const ca = estaCompleto(a.info) ? 1 : 0;
          const cb = estaCompleto(b.info) ? 1 : 0;
          return ca - cb || a.clave.localeCompare(b.clave, undefined, { numeric: true });
        }),
    };
  }, [beacons]);

  const revisionVisible = datos.revision.slice(0, 5);

  // Sólo en la carga inicial (sin datos todavía) mostramos el esqueleto;
  // un refresco posterior conserva el panel y avisa con el icono girando.
  if (cargando && datos.total === 0) {
    return (
      <>
        <EsqueletoKpis />
        <div className="rejilla rejilla--dos anim-entra">
          {[0, 1].map((i) => (
            <section className="panel" key={i}>
              <div className="esqueleto esqueleto--linea" style={{ width: "40%", height: 16 }} />
              <div className="esqueleto esqueleto--bloque" />
            </section>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <section className="kpis anim-entra">
        <Kpi
          Icono={IconoBeacon}
          etiqueta="Beacons registrados"
          valor={datos.total}
          nota={`${datos.majors} ${datos.majors === 1 ? "major distinto" : "majors distintos"}`}
        />
        <Kpi
          Icono={IconoUbicacion}
          etiqueta="Ubicaciones cubiertas"
          valor={datos.ubicaciones}
          nota={
            datos.sinUbicacion > 0
              ? `${datos.sinUbicacion} sin ubicación asignada`
              : "Todos los beacons ubicados"
          }
        />
        <Kpi
          Icono={datos.incompletos > 0 ? IconoAlerta : IconoOk}
          tono={datos.incompletos > 0 ? "kpi__icono--aviso" : "kpi__icono--ok"}
          etiqueta="Fichas incompletas"
          valor={datos.incompletos}
          nota={
            datos.incompletos > 0
              ? "Les falta título, descripción o ubicación"
              : "Todas las fichas están completas"
          }
        />
        <Kpi
          Icono={IconoServidor}
          tono={hayConexion ? "kpi__icono--ok" : "kpi__icono--peligro"}
          etiqueta="Servidor de contenidos"
          valor={
            <span className={`badge ${hayConexion ? "badge--ok" : "badge--peligro"}`}>
              {hayConexion ? <IconoOk size={14} /> : <IconoAlerta size={14} />}
              {hayConexion ? "Conectado" : "Sin conexión"}
            </span>
          }
          valorTexto
          nota={hayConexion ? "localhost:3000 · /beacons" : "Arranca el servidor en el puerto 3000"}
        />
      </section>

      <div className="rejilla rejilla--dos anim-entra">
        <section className="panel">
          <div className="panel__head">
            <div>
              <h2>Beacons por ubicación</h2>
              <p>Cuántos beacons hay desplegados en cada zona.</p>
            </div>
          </div>

          {datos.barras.length === 0 ? (
            <p className="vacio">Todavía no hay beacons que representar.</p>
          ) : (
            <div className="barras">
              {datos.barras.map(([nombre, n]) => (
                <div key={nombre} title={`${nombre}: ${n} ${n === 1 ? "beacon" : "beacons"}`}>
                  <div className="barra__cab">
                    <span className="barra__nombre">{nombre}</span>
                    <span className="barra__valor">{n}</span>
                  </div>
                  <div className="barra__track">
                    <div
                      className="barra__fill"
                      style={{ width: `${Math.round((n / datos.maximo) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__head">
            <div>
              <h2>Revisión de contenido</h2>
              <p>Primero lo que falta por completar.</p>
            </div>
            {datos.revision.length > revisionVisible.length && (
              <button className="btn--enlace" onClick={onVerTodos}>
                Ver todos
              </button>
            )}
          </div>

          {revisionVisible.length === 0 ? (
            <p className="vacio">No hay beacons registrados.</p>
          ) : (
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Beacon</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {revisionVisible.map(({ clave, info }) => {
                    const completo = estaCompleto(info);
                    return (
                      <tr
                        key={clave}
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
                          <span className="celda-titulo">{info.titulo?.trim() || "(sin título)"}</span>
                          <span className="celda-sub">{clave}</span>
                        </td>
                        <td>
                          <span className={`badge ${completo ? "badge--ok" : "badge--aviso"}`}>
                            {completo ? <IconoOk size={14} /> : <IconoAlerta size={14} />}
                            {completo ? "Completo" : "Incompleto"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}