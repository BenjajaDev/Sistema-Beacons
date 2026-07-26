import { useEffect, useState, useCallback } from "react";
import { listarBeacons, guardarBeacon, borrarBeacon } from "./api.js";
import BeaconList from "./components/BeaconList.jsx";
import BeaconForm from "./components/BeaconForm.jsx";

export default function App() {
  const [beacons, setBeacons] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  // Clave del beacon en edicion ("major-minor"), o null para "nuevo".
  const [editando, setEditando] = useState(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await listarBeacons();
      setBeacons(datos);
    } catch (e) {
      setError(`No se pudo conectar con el servidor (${e.message}). ¿Está arrancado en el puerto 3000?`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  function mostrarAviso(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3000);
  }

  async function handleGuardar(major, minor, info) {
    await guardarBeacon(major, minor, info);
    mostrarAviso(`Beacon ${major}-${minor} guardado.`);
    setEditando(null);
    await recargar();
  }

  async function handleBorrar(clave) {
    const [major, minor] = clave.split("-");
    if (!confirm(`¿Borrar el beacon ${clave}?`)) return;
    try {
      await borrarBeacon(major, minor);
      mostrarAviso(`Beacon ${clave} borrado.`);
      if (editando === clave) setEditando(null);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  // Datos del beacon que se está editando (o null si es uno nuevo).
  const beaconEnEdicion = editando ? { clave: editando, ...beacons[editando] } : null;

  return (
    <div className="layout">
      <header className="header">
        <h1>📡 CMS de Beacons</h1>
        <p>Configura la información que verá la app al detectar cada beacon.</p>
      </header>

      {aviso && <div className="banner banner--ok">{aviso}</div>}
      {error && <div className="banner banner--error">{error}</div>}

      <main className="main">
        <section className="panel">
          <div className="panel__head">
            <h2>Beacons</h2>
            <button className="btn btn--primary" onClick={() => setEditando(null)}>
              + Nuevo beacon
            </button>
          </div>

          {cargando ? (
            <p className="muted">Cargando…</p>
          ) : (
            <BeaconList
              beacons={beacons}
              seleccionado={editando}
              onEditar={(clave) => setEditando(clave)}
              onBorrar={handleBorrar}
            />
          )}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>{beaconEnEdicion ? `Editar ${beaconEnEdicion.clave}` : "Nuevo beacon"}</h2>
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
      </main>
    </div>
  );
}
