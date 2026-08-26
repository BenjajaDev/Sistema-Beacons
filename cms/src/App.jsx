import { useEffect, useState, useCallback } from "react";
import { listarBeacons, guardarBeacon, borrarBeacon } from "./api.js";
import useTema from "./hooks/useTema.js";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import BeaconList from "./components/BeaconList.jsx";
import BeaconForm from "./components/BeaconForm.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import { IconoOk, IconoAlerta } from "./components/Iconos.jsx";

const TITULOS = {
  resumen: {
    titulo: "Resumen",
    subtitulo: "Estado del despliegue de beacons y de su contenido.",
  },
  beacons: {
    titulo: "Beacons",
    subtitulo: "Configura la información que verá la app al detectar cada beacon.",
  },
};

export default function App() {
  const [beacons, setBeacons] = useState({});
  const [cargando, setCargando] = useState(true);
  const [hayConexion, setHayConexion] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [avisoSaliendo, setAvisoSaliendo] = useState(false);
  // Sección visible del panel: "resumen" o "beacons".
  const [vista, setVista] = useState("resumen");
  const [busqueda, setBusqueda] = useState("");
  // Clave del beacon en edición ("major-minor"), o null para "nuevo".
  const [editando, setEditando] = useState(null);
  // Clave pendiente de confirmar borrado, o null si el diálogo está cerrado.
  const [borrando, setBorrando] = useState(null);

  const [tema, alternarTema] = useTema();

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await listarBeacons();
      setBeacons(datos);
      setHayConexion(true);
    } catch (e) {
      setHayConexion(false);
      setError(
        `No se pudo conectar con el servidor (${e.message}). ¿Está arrancado en el puerto 3000?`
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  function mostrarAviso(texto) {
    setAvisoSaliendo(false);
    setAviso(texto);
    setTimeout(() => setAvisoSaliendo(true), 2700);
    setTimeout(() => {
      setAviso(null);
      setAvisoSaliendo(false);
    }, 3000);
  }

  async function handleGuardar(major, minor, info) {
    await guardarBeacon(major, minor, info);
    mostrarAviso(`Beacon ${major}-${minor} guardado.`);
    setEditando(null);
    await recargar();
  }

  async function confirmarBorrado() {
    const clave = borrando;
    if (!clave) return;
    const [major, minor] = clave.split("-");
    setBorrando(null);
    try {
      await borrarBeacon(major, minor);
      mostrarAviso(`Beacon ${clave} borrado.`);
      if (editando === clave) setEditando(null);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  // Editar desde cualquier vista lleva a la lista con el formulario cargado.
  function handleEditar(clave) {
    setEditando(clave);
    setVista("beacons");
  }

  function handleNuevo() {
    setEditando(null);
    setVista("beacons");
  }

  // Datos del beacon que se está editando (o null si es uno nuevo).
  const beaconEnEdicion = editando ? { clave: editando, ...beacons[editando] } : null;
  const total = Object.keys(beacons).length;

  return (
    <div className="app">
      <Sidebar vista={vista} onVista={setVista} total={total} />

      <div className="contenido">
        <Topbar
          titulo={TITULOS[vista].titulo}
          subtitulo={TITULOS[vista].subtitulo}
          busqueda={busqueda}
          onBuscar={setBusqueda}
          mostrarBuscador={vista === "beacons"}
          onRecargar={recargar}
          onNuevo={handleNuevo}
          cargando={cargando}
          tema={tema}
          onTema={alternarTema}
        />

        <main className="vista">
          {vista === "resumen" && (
            <Dashboard
              beacons={beacons}
              cargando={cargando}
              hayConexion={hayConexion}
              onEditar={handleEditar}
              onVerTodos={() => setVista("beacons")}
            />
          )}

          {vista === "beacons" && (
            <div className="rejilla rejilla--dos anim-entra">
              <section className="panel">
                <div className="panel__head">
                  <div>
                    <h2>Beacons registrados</h2>
                    <p>Selecciona uno para editar su ficha.</p>
                  </div>
                </div>

                {cargando ? (
                  <p className="vacio">Cargando…</p>
                ) : (
                  <BeaconList
                    beacons={beacons}
                    seleccionado={editando}
                    busqueda={busqueda}
                    onEditar={handleEditar}
                    onBorrar={setBorrando}
                  />
                )}
              </section>

              <section className="panel panel--sticky">
                <div className="panel__head">
                  <div>
                    <h2>{beaconEnEdicion ? `Editar ${beaconEnEdicion.clave}` : "Nuevo beacon"}</h2>
                    <p>
                      {beaconEnEdicion
                        ? "Los cambios se publican al guardar."
                        : "Registra un beacon y su contenido."}
                    </p>
                  </div>
                </div>
                <BeaconForm
                  key={editando || "nuevo"}
                  beacon={beaconEnEdicion}
                  beaconsExistentes={beacons}
                  onGuardar={handleGuardar}
                  onCancelar={() => setEditando(null)}
                  onError={setError}
                />
              </section>
            </div>
          )}
        </main>
      </div>

      <div className="avisos" role="status" aria-live="polite">
        {aviso && (
          <div className={`aviso aviso--ok ${avisoSaliendo ? "aviso--sale" : ""}`}>
            <IconoOk size={17} />
            <span>{aviso}</span>
          </div>
        )}
        {error && (
          <div className="aviso aviso--error">
            <IconoAlerta size={17} />
            <span>{error}</span>
            <button className="aviso__cerrar" onClick={() => setError(null)} aria-label="Cerrar">
              ×
            </button>
          </div>
        )}
      </div>

      {borrando && (
        <ConfirmDialog
          titulo="Borrar beacon"
          onConfirmar={confirmarBorrado}
          onCancelar={() => setBorrando(null)}
        >
          Esta acción no se puede deshacer. Se eliminará el beacon{" "}
          <span className="clave">{borrando}</span> y toda su ficha.
        </ConfirmDialog>
      )}
    </div>
  );
}
