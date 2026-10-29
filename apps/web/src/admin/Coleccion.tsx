import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button, IconButton } from "@shared/ui/Button";
import { ConfirmDialog, Dialog } from "@shared/ui/Dialog";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { adminFetch } from "./api";
import { Interruptor } from "./ui";

// Lista ordenable del panel (equipo, colaboradores, respaldos): agregar, editar en
// un diálogo, mostrar u ocultar, reordenar con ↑ ↓ y borrar con confirmación.

export interface Base {
  id: string;
  name: string;
  visible: boolean;
}

export interface Config<T extends Base, F> {
  ruta: string;
  titulo: string;
  elemento: string;
  vacio: string;
  descripcion: (item: T) => ReactNode;
  miniatura: (item: T) => string | null;
  aFormulario: (item: T | null) => F;
  aCuerpo: (form: F) => Record<string, unknown>;
  Campos: (p: { form: F; set: (f: F) => void; errores: Record<string, string> }) => ReactNode;
}

export function Coleccion<T extends Base, F>({ c }: { c: Config<T, F> }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const clave = ["admin", c.ruta];
  const [editando, setEditando] = useState<T | "nuevo" | null>(null);
  const [form, setForm] = useState<F>(c.aFormulario(null));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [borrando, setBorrando] = useState<T | null>(null);
  const [anuncio, setAnuncio] = useState("");

  const { data, isPending, error, refetch } = useQuery({
    queryKey: clave,
    queryFn: () => adminFetch<{ items: T[] }>(c.ruta),
  });
  const invalidar = () => queryClient.invalidateQueries({ queryKey: clave });

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo = c.aCuerpo(form);
      return editando === "nuevo"
        ? adminFetch(c.ruta, { method: "POST", body: cuerpo })
        : adminFetch(`${c.ruta}/${(editando as T).id}`, { method: "PATCH", body: cuerpo });
    },
    onSuccess: () => {
      toast.exito(editando === "nuevo" ? `${c.elemento} agregado.` : "Cambios guardados.");
      setEditando(null);
      invalidar();
    },
    onError: (err) => {
      if (err instanceof ApiError && Object.keys(err.campos).length) setErrores(err.campos);
      else toast.error(`No se pudo guardar. ${mensajeDeError(err)}`);
    },
  });

  const parche = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      adminFetch(`${c.ruta}/${id}`, { method: "PATCH", body }),
    onSuccess: invalidar,
    onError: (err) => toast.error(`No se pudo cambiar. ${mensajeDeError(err)}`),
  });

  const orden = useMutation({
    mutationFn: (ids: string[]) => adminFetch(`${c.ruta}/order`, { method: "PUT", body: { ids } }),
    onSuccess: invalidar,
    onError: (err) => toast.error(`No se pudo cambiar el orden. ${mensajeDeError(err)}`),
  });

  function abrir(item: T | "nuevo") {
    setForm(c.aFormulario(item === "nuevo" ? null : item));
    setErrores({});
    setEditando(item);
  }

  function mover(lista: T[], i: number, d: number) {
    if (i + d < 0 || i + d >= lista.length) return;
    const ids = lista.map((x) => x.id);
    [ids[i], ids[i + d]] = [ids[i + d]!, ids[i]!];
    orden.mutate(ids);
    setAnuncio(`«${lista[i]!.name}» ahora está en la posición ${i + d + 1} de ${lista.length}.`);
  }

  return (
    <section className="grupo-secciones" aria-labelledby={`grupo-${c.ruta}`}>
      <div className="vista-cabecera">
        <h2 id={`grupo-${c.ruta}`}>{c.titulo}</h2>
        <Button onClick={() => abrir("nuevo")}>Agregar {c.elemento.toLowerCase()}</Button>
      </div>
      <p className="visually-hidden" role="status">
        {anuncio}
      </p>
      {isPending ? (
        <Cargando>
          <Skeleton alto="8rem" />
        </Cargando>
      ) : error ? (
        <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          titulo={c.vacio}
          accion={
            <Button onClick={() => abrir("nuevo")}>Agregar {c.elemento.toLowerCase()}</Button>
          }
        />
      ) : (
        <ol className="lista-secciones">
          {data.items.map((item, i) => (
            <li key={item.id} className="fila-seccion">
              {c.miniatura(item) ? (
                <img src={c.miniatura(item)!} alt="" className="miniatura" />
              ) : (
                <span className="miniatura miniatura--vacia" aria-hidden="true" />
              )}
              <div className="fila-seccion__info">
                <strong>{item.name}</strong>
                <span className="texto-suave">
                  {c.descripcion(item)}
                  {!item.visible && " · oculto en el sitio"}
                </span>
              </div>
              <div className="fila-seccion__acciones">
                <Interruptor
                  activo={item.visible}
                  etiqueta={`Visible: ${item.name}`}
                  onCambiar={(visible) => parche.mutate({ id: item.id, body: { visible } })}
                />
                <IconButton
                  label={`Subir a ${item.name}`}
                  aria-disabled={i === 0 || undefined}
                  onClick={() => mover(data.items, i, -1)}
                >
                  <span aria-hidden="true">↑</span>
                </IconButton>
                <IconButton
                  label={`Bajar a ${item.name}`}
                  aria-disabled={i === data.items.length - 1 || undefined}
                  onClick={() => mover(data.items, i, 1)}
                >
                  <span aria-hidden="true">↓</span>
                </IconButton>
                <Button variante="secundario" onClick={() => abrir(item)}>
                  Editar<span className="visually-hidden"> a {item.name}</span>
                </Button>
                <Button variante="fantasma" onClick={() => setBorrando(item)}>
                  Borrar<span className="visually-hidden"> a {item.name}</span>
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
        titulo={
          editando === "nuevo"
            ? `Agregar ${c.elemento.toLowerCase()}`
            : `Editar: ${(editando as T | null)?.name ?? ""}`
        }
        acciones={
          <>
            <Button variante="secundario" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button
              cargando={guardar.isPending}
              textoCargando="Guardando…"
              onClick={() => guardar.mutate()}
            >
              Guardar
            </Button>
          </>
        }
      >
        <c.Campos form={form} set={setForm} errores={errores} />
      </Dialog>

      <ConfirmDialog
        abierto={borrando !== null}
        onCerrar={() => setBorrando(null)}
        titulo={`¿Borrar a ${borrando?.name}?`}
        mensaje="Dejará de aparecer en el sitio. No se puede deshacer; si solo quieres ocultarlo, usa el interruptor «Visible»."
        textoConfirmar={`Borrar a ${borrando?.name}`}
        onConfirmar={async () => {
          try {
            await adminFetch(`${c.ruta}/${borrando!.id}`, { method: "DELETE" });
            toast.exito(`${borrando!.name} fue borrado.`);
            invalidar();
          } catch (err) {
            toast.error(`No se pudo borrar. ${mensajeDeError(err)}`);
          }
        }}
      />
    </section>
  );
}
