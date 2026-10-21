import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { ConfirmDialog } from "@shared/ui/Dialog";
import { ErrorSummary } from "@shared/ui/ErrorSummary";
import { TextArea, TextField } from "@shared/ui/Field";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { adminFetch, type Beacon } from "../api";
import { AvisoCambiosSinGuardar, Cabecera, formatoFecha, usePanelPage } from "../ui";

// CMS de beacons (antes una app aparte, cms/). Lo que se guarda aquí es lo que la app Android
// muestra y lee en voz alta al detectar cada beacon.

interface Resumen {
  total: number;
  completos: number;
  incompletos: number;
}

interface FormBeacon {
  major: string;
  minor: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
}

const VACIO: FormBeacon = { major: "", minor: "", titulo: "", descripcion: "", ubicacion: "" };

const faltantes = (b: Beacon) =>
  [
    !b.titulo.trim() && "título",
    !b.descripcion.trim() && "descripción",
    !b.ubicacion?.trim() && "ubicación",
  ]
    .filter(Boolean)
    .join(", ");

// La app lee la descripción con la voz del teléfono: aquí se puede escuchar igual.
function Escuchar({ texto }: { texto: string }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return (
    <Button
      variante="secundario"
      onClick={() => {
        window.speechSynthesis.cancel();
        const voz = new SpeechSynthesisUtterance(texto);
        voz.lang = "es-CL";
        window.speechSynthesis.speak(voz);
      }}
      aria-disabled={!texto.trim() || undefined}
    >
      Escuchar descripción
    </Button>
  );
}

function Formulario({
  beacon,
  existentes,
  onListo,
}: {
  beacon: Beacon | null;
  existentes: Beacon[];
  onListo: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const inicial = useMemo<FormBeacon>(
    () =>
      beacon
        ? {
            major: String(beacon.major),
            minor: String(beacon.minor),
            titulo: beacon.titulo,
            descripcion: beacon.descripcion,
            ubicacion: beacon.ubicacion ?? "",
          }
        : VACIO,
    [beacon],
  );
  const [form, setForm] = useState(inicial);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const sucio = JSON.stringify(form) !== JSON.stringify(inicial);
  const set = (c: keyof FormBeacon, v: string) => setForm((f) => ({ ...f, [c]: v }));

  async function guardar() {
    const e: Record<string, string> = {};
    for (const c of ["major", "minor"] as const) {
      if (!/^\d+$/.test(form[c]) || Number(form[c]) > 65535)
        e[`beacon-${c}`] = `El ${c} debe ser un número entre 0 y 65535.`;
    }
    if (!form.titulo.trim()) e["beacon-titulo"] = "Escribe un título.";
    if (!form.descripcion.trim())
      e["beacon-descripcion"] = "Escribe la descripción que se leerá en voz alta.";
    const clave = `${Number(form.major)}-${Number(form.minor)}`;
    if (
      !e["beacon-major"] &&
      !e["beacon-minor"] &&
      existentes.some((b) => b.clave === clave && b.id !== beacon?.id)
    ) {
      e["beacon-minor"] = `Ya existe el beacon ${clave}. Edítalo desde la lista.`;
    }
    setErrores(e);
    if (Object.keys(e).length) return;

    setGuardando(true);
    try {
      const body = {
        major: Number(form.major),
        minor: Number(form.minor),
        titulo: form.titulo,
        descripcion: form.descripcion,
        ubicacion: form.ubicacion || null,
      };
      if (beacon) await adminFetch(`/beacons/${beacon.id}`, { method: "PUT", body });
      else await adminFetch("/beacons", { method: "POST", body });
      toast.exito(
        beacon && beacon.clave !== clave
          ? `Beacon movido de ${beacon.clave} a ${clave}. La app ya recibe la ficha nueva.`
          : `Beacon ${clave} guardado. La app ya recibe la ficha.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "beacons"] });
      if (!beacon) setForm(VACIO);
      onListo();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.campos).length) {
        setErrores(
          Object.fromEntries(Object.entries(err.campos).map(([c, m]) => [`beacon-${c}`, m])),
        );
      } else {
        toast.error(`No se pudo guardar el beacon. ${mensajeDeError(err)}`);
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <AvisoCambiosSinGuardar sucio={sucio} />
      <ErrorSummary
        errores={Object.entries(errores).map(([campoId, mensaje]) => ({ campoId, mensaje }))}
      />
      <div className="rejilla-panel rejilla-panel--dos">
        <TextField
          id="beacon-major"
          label="Major"
          inputMode="numeric"
          value={form.major}
          onChange={(e) => set("major", e.target.value.trim())}
          error={errores["beacon-major"]}
        />
        <TextField
          id="beacon-minor"
          label="Minor"
          inputMode="numeric"
          value={form.minor}
          onChange={(e) => set("minor", e.target.value.trim())}
          error={errores["beacon-minor"]}
        />
      </div>
      <p className="campo__ayuda">
        {beacon
          ? `Identificadores del beacon físico. Si los cambias, la ficha pasa de ${beacon.clave} a ${form.major || "?"}-${form.minor || "?"} al guardar, en un solo paso.`
          : "Identificadores del beacon físico. Juntos forman la clave major-minor."}
      </p>
      <TextField
        id="beacon-titulo"
        label="Título"
        placeholder="Entrada principal"
        maxLength={120}
        value={form.titulo}
        onChange={(e) => set("titulo", e.target.value)}
        error={errores["beacon-titulo"]}
      />
      <TextArea
        id="beacon-descripcion"
        label="Descripción (se lee en voz alta)"
        rows={5}
        maxLength={1000}
        value={form.descripcion}
        onChange={(e) => set("descripcion", e.target.value)}
        error={errores["beacon-descripcion"]}
        ayuda="Es lo único que escucha quien no ve la pantalla: nombra el lugar y di cómo llegar al siguiente punto (pasos, izquierda o derecha). Frases cortas, sin abreviaturas."
      />
      <TextField
        id="beacon-ubicacion"
        label="Ubicación"
        opcional
        placeholder="Planta baja - Vestíbulo"
        maxLength={120}
        value={form.ubicacion}
        onChange={(e) => set("ubicacion", e.target.value)}
      />
      <div className="fila-botones">
        <Button type="submit" cargando={guardando} textoCargando="Guardando…">
          {beacon ? "Guardar cambios" : "Registrar beacon"}
        </Button>
        <Escuchar texto={form.descripcion} />
        {beacon && (
          <Button variante="fantasma" onClick={onListo}>
            Cancelar edición
          </Button>
        )}
      </div>
    </form>
  );
}

export default function Beacons() {
  const h1 = usePanelPage("Beacons");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Beacon | null>(null);
  const [borrando, setBorrando] = useState<Beacon | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin", "beacons"],
    queryFn: () => adminFetch<{ items: Beacon[]; resumen: Resumen }>("/beacons"),
  });

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (b) =>
        !q ||
        [b.clave, b.titulo, b.descripcion, b.ubicacion ?? ""].some((t) =>
          t.toLowerCase().includes(q),
        ),
    );
  }, [data, busqueda]);

  const porUbicacion = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of data?.items ?? [])
      m.set(
        b.ubicacion?.trim() || "Sin ubicación",
        (m.get(b.ubicacion?.trim() || "Sin ubicación") ?? 0) + 1,
      );
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const r = data?.resumen;
  const porcentaje = r && r.total ? Math.round((r.completos / r.total) * 100) : 0;

  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Beacons"
        descripcion="Configura lo que la app anuncia al detectar cada beacon. Los cambios llegan a la app al guardar."
      />

      {isPending ? (
        <Cargando etiqueta="Cargando beacons…">
          <Skeleton alto="20rem" />
        </Cargando>
      ) : error ? (
        <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : (
        <>
          <div className="rejilla-panel">
            <section className="tarjeta-panel" aria-labelledby="beacons-estado">
              <h2 id="beacons-estado">Estado de las fichas</h2>
              <p>
                <strong className="cifra">{r!.completos}</strong> de {r!.total} completas (
                {porcentaje} %).
              </p>
              <meter
                className="medidor"
                min={0}
                max={r!.total || 1}
                value={r!.completos}
                aria-label="Fichas completas"
              >
                {porcentaje} %
              </meter>
              <p className="texto-suave">
                Una ficha está completa si tiene título, descripción y ubicación.
              </p>
            </section>
            <section className="tarjeta-panel" aria-labelledby="beacons-ubicacion">
              <h2 id="beacons-ubicacion">Por ubicación</h2>
              {porUbicacion.length ? (
                <ul className="lista-simple">
                  {porUbicacion.map(([u, n]) => (
                    <li key={u}>
                      {u}: {n} {n === 1 ? "beacon" : "beacons"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="texto-suave">Sin datos aún.</p>
              )}
            </section>
            <section className="tarjeta-panel" aria-labelledby="beacons-revision">
              <h2 id="beacons-revision">Por completar</h2>
              {r!.incompletos === 0 ? (
                <p className="texto-ok">Todas las fichas están completas.</p>
              ) : (
                <ul className="lista-simple">
                  {data.items
                    .filter((b) => !b.completo)
                    .map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          className="enlace-boton"
                          onClick={() => setEditando(b)}
                        >
                          {b.clave} · {b.titulo || "(sin título)"}
                        </button>
                        <span className="texto-suave"> · falta {faltantes(b)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>

          <div className="beacons">
            <section className="tarjeta-panel" aria-labelledby="beacons-lista">
              <h2 id="beacons-lista">Beacons registrados</h2>
              <TextField
                label="Buscar por clave, título o ubicación"
                opcional
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <p className="visually-hidden" role="status">
                {busqueda ? `${filtrados.length} resultados` : ""}
              </p>
              {data.items.length === 0 ? (
                <EmptyState
                  titulo="Aún no hay beacons"
                  texto="Registra el primero con el formulario."
                />
              ) : filtrados.length === 0 ? (
                <EmptyState
                  titulo="Ningún beacon coincide con la búsqueda"
                  texto="Prueba con otra palabra o borra la búsqueda."
                />
              ) : (
                <ul className="lista-beacons">
                  {filtrados.map((b) => (
                    <li
                      key={b.id}
                      className={`ficha-beacon ${editando?.id === b.id ? "ficha-beacon--activa" : ""}`}
                    >
                      <div>
                        <p className="ficha-beacon__clave">
                          {b.clave}{" "}
                          {!b.completo && (
                            <span className="insignia insignia--aviso">Incompleta</span>
                          )}
                        </p>
                        <h3>{b.titulo || "(sin título)"}</h3>
                        <p className="texto-suave">
                          {b.ubicacion || "Sin ubicación"} · editado {formatoFecha(b.updatedAt)}
                        </p>
                      </div>
                      <div className="fila-botones">
                        <Button variante="secundario" onClick={() => setEditando(b)}>
                          Editar<span className="visually-hidden"> beacon {b.clave}</span>
                        </Button>
                        <Button variante="fantasma" onClick={() => setBorrando(b)}>
                          Borrar<span className="visually-hidden"> beacon {b.clave}</span>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="tarjeta-panel beacons__formulario" aria-labelledby="beacons-form">
              <h2 id="beacons-form">
                {editando ? `Editar beacon ${editando.clave}` : "Registrar un beacon"}
              </h2>
              <Formulario
                key={editando?.id ?? "nuevo"}
                beacon={editando}
                existentes={data.items}
                onListo={() => setEditando(null)}
              />
            </section>
          </div>
        </>
      )}

      <ConfirmDialog
        abierto={borrando !== null}
        onCerrar={() => setBorrando(null)}
        titulo={`¿Borrar el beacon ${borrando?.clave}?`}
        mensaje="La app dejará de anunciar este punto de inmediato. No se puede deshacer."
        textoConfirmar={`Borrar beacon ${borrando?.clave}`}
        onConfirmar={async () => {
          try {
            await adminFetch(`/beacons/${borrando!.id}`, { method: "DELETE" });
            toast.exito(`Beacon ${borrando!.clave} borrado.`);
            if (editando?.id === borrando!.id) setEditando(null);
            await queryClient.invalidateQueries({ queryKey: ["admin", "beacons"] });
          } catch (err) {
            toast.error(`No se pudo borrar. ${mensajeDeError(err)}`);
          }
        }}
      />
    </div>
  );
}
