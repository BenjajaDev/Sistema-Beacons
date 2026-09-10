import { useState } from "react";

// Formulario para crear o editar un beacon.
// Si recibe `beacon` (con su clave) está en modo edición; si no, modo creación.
export default function BeaconForm({ beacon, beaconsExistentes, onGuardar, onCancelar, onError }) {
  const esEdicion = Boolean(beacon);

  // En edición, major/minor salen de la clave "major-minor" y se pueden cambiar:
  // al guardar, la ficha se mueve a la nueva clave.
  const [major, minor] = esEdicion ? beacon.clave.split("-") : ["", ""];

  const [form, setForm] = useState({
    major,
    minor,
    titulo: beacon?.titulo || "",
    descripcion: beacon?.descripcion || "",
    ubicacion: beacon?.ubicacion || "",
  });
  const [guardando, setGuardando] = useState(false);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    onError(null);

    const maj = form.major.trim();
    const min = form.minor.trim();

    if (!maj || !min) {
      onError("Major y minor son obligatorios.");
      return;
    }
    if (!/^\d+$/.test(maj) || !/^\d+$/.test(min)) {
      onError("Major y minor deben ser números.");
      return;
    }
    if (!form.titulo.trim()) {
      onError("El título es obligatorio.");
      return;
    }
    // Evita pisar un beacon existente, tanto al crear como al renombrar la clave.
    const nuevaClave = `${maj}-${min}`;
    if (nuevaClave !== beacon?.clave && beaconsExistentes[nuevaClave]) {
      onError(`Ya existe el beacon ${nuevaClave}. Edítalo desde la lista.`);
      return;
    }

    setGuardando(true);
    try {
      await onGuardar(
        maj,
        min,
        {
          titulo: form.titulo.trim(),
          descripcion: form.descripcion.trim(),
          ubicacion: form.ubicacion.trim(),
        },
        // Clave original: si cambió, App mueve la ficha y borra la antigua.
        beacon?.clave ?? null
      );
      if (!esEdicion) {
        // Limpia el formulario tras crear.
        setForm({ major: "", minor: "", titulo: "", descripcion: "", ubicacion: "" });
      }
    } catch (err) {
      onError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form__fila">
        <label className="campo">
          <span className="campo__label">Major</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.major}
            onChange={(e) => actualizar("major", e.target.value)}
            placeholder="1"
          />
        </label>
        <label className="campo">
          <span className="campo__label">Minor</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.minor}
            onChange={(e) => actualizar("minor", e.target.value)}
            placeholder="1"
          />
        </label>
      </div>
      <p className="campo__ayuda">
        {esEdicion
          ? `Identificadores del beacon físico. Si los cambias, la ficha se moverá de ${beacon.clave} a ${form.major || "?"}-${form.minor || "?"} al guardar.`
          : "Identificadores del beacon físico. Juntos forman la clave major-minor."}
      </p>

      <label className="campo">
        <span className="campo__label">Título</span>
        <input
          type="text"
          value={form.titulo}
          onChange={(e) => actualizar("titulo", e.target.value)}
          placeholder="Entrada principal"
        />
      </label>

      <label className="campo">
        <span className="campo__label">Descripción</span>
        <textarea
          rows={5}
          value={form.descripcion}
          onChange={(e) => actualizar("descripcion", e.target.value)}
          placeholder="Texto que verá el usuario al acercarse a este beacon."
        />
      </label>

      <label className="campo">
        <span className="campo__label">Ubicación</span>
        <input
          type="text"
          value={form.ubicacion}
          onChange={(e) => actualizar("ubicacion", e.target.value)}
          placeholder="Planta baja - Vestíbulo"
        />
      </label>

      <div className="form__acciones">
        <button type="submit" className="btn btn--primary" disabled={guardando}>
          {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear beacon"}
        </button>
        {esEdicion && (
          <button type="button" className="btn" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}