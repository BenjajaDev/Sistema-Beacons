import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button, IconButton } from "@shared/ui/Button";
import { ConfirmDialog, Dialog } from "@shared/ui/Dialog";
import { TextArea, TextField } from "@shared/ui/Field";
import { Cargando, EmptyState, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { adminFetch, type Colaborador, type Enlace, type Persona } from "../api";
import { Cabecera, Interruptor, SelectorImagen, usePanelPage, type ImagenElegida } from "../ui";

interface Base {
  id: string;
  name: string;
  visible: boolean;
}

interface Config<T extends Base, F> {
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

function Coleccion<T extends Base, F>({ c }: { c: Config<T, F> }) {
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

// --- Equipo ---

interface FormPersona {
  name: string;
  position: string;
  bio: string;
  photo: ImagenElegida | null;
  photoAlt: string;
  links: Enlace[];
}

function CamposPersona({
  form,
  set,
  errores,
}: {
  form: FormPersona;
  set: (f: FormPersona) => void;
  errores: Record<string, string>;
}) {
  return (
    <>
      <TextField
        label="Nombre"
        value={form.name}
        maxLength={120}
        onChange={(e) => set({ ...form, name: e.target.value })}
        error={errores.name}
        data-autofocus
      />
      <TextField
        label="Cargo o rol"
        value={form.position}
        maxLength={120}
        onChange={(e) => set({ ...form, position: e.target.value })}
        error={errores.position}
      />
      <TextArea
        label="Biografía breve"
        opcional
        rows={3}
        maxLength={600}
        value={form.bio}
        onChange={(e) => set({ ...form, bio: e.target.value })}
        error={errores.bio}
      />
      <SelectorImagen
        etiqueta="Foto (opcional)"
        marco={{ proporcion: 1, nombre: "cuadrado" }}
        imagen={form.photo}
        alt={form.photoAlt}
        onCambiar={(photo, photoAlt) => set({ ...form, photo, photoAlt })}
        errorAlt={errores.photoAlt}
        ayudaAlt="Describe a la persona en la foto, por ejemplo «Ana sonriendo frente a un pizarrón». No repitas solo su nombre."
      />
      <ListaEnlaces
        enlaces={form.links}
        onCambiar={(links) => set({ ...form, links })}
        errores={errores}
      />
    </>
  );
}

function ListaEnlaces({
  enlaces,
  onCambiar,
  errores,
}: {
  enlaces: Enlace[];
  onCambiar: (e: Enlace[]) => void;
  errores: Record<string, string>;
}) {
  return (
    <fieldset className="grupo-campos">
      <legend>
        Enlaces <span className="campo__opcional">(opcional)</span>
      </legend>
      {enlaces.map((en, i) => (
        <div key={i} className="grupo-campos grupo-campos--item">
          <TextField
            label={`Red o sitio ${i + 1}`}
            value={en.red}
            placeholder="LinkedIn"
            onChange={(e) =>
              onCambiar(enlaces.map((x, j) => (j === i ? { ...x, red: e.target.value } : x)))
            }
            error={errores[`links.${i}.red`]}
          />
          <TextField
            label={`Dirección ${i + 1}`}
            value={en.url}
            placeholder="https://"
            onChange={(e) =>
              onCambiar(enlaces.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
            }
            error={errores[`links.${i}.url`]}
          />
          <Button variante="fantasma" onClick={() => onCambiar(enlaces.filter((_, j) => j !== i))}>
            Quitar enlace {i + 1}
          </Button>
        </div>
      ))}
      {enlaces.length < 6 && (
        <Button variante="secundario" onClick={() => onCambiar([...enlaces, { red: "", url: "" }])}>
          Agregar enlace
        </Button>
      )}
    </fieldset>
  );
}

const equipo: Config<Persona, FormPersona> = {
  ruta: "/team",
  titulo: "Equipo",
  elemento: "Persona",
  vacio: "Aún no hay personas en el equipo",
  descripcion: (p) => p.position,
  miniatura: (p) => p.photo?.url ?? null,
  aFormulario: (p) => ({
    name: p?.name ?? "",
    position: p?.position ?? "",
    bio: p?.bio ?? "",
    photo: p?.photo ? { id: p.photo.id, url: p.photo.url } : null,
    photoAlt: p?.photoAlt ?? "",
    links: p?.links ?? [],
  }),
  aCuerpo: (f) => ({
    name: f.name,
    position: f.position,
    bio: f.bio || null,
    photoId: f.photo?.id ?? null,
    photoAlt: f.photo ? f.photoAlt : null,
    links: f.links,
  }),
  Campos: CamposPersona,
};

// --- Colaboradores ---

interface FormColaborador {
  name: string;
  description: string;
  url: string;
  logo: ImagenElegida | null;
  logoAlt: string;
}

function CamposColaborador({
  form,
  set,
  errores,
}: {
  form: FormColaborador;
  set: (f: FormColaborador) => void;
  errores: Record<string, string>;
}) {
  return (
    <>
      <TextField
        label="Nombre"
        value={form.name}
        maxLength={120}
        onChange={(e) => set({ ...form, name: e.target.value })}
        error={errores.name}
        data-autofocus
      />
      <TextArea
        label="Descripción"
        opcional
        rows={2}
        maxLength={300}
        value={form.description}
        onChange={(e) => set({ ...form, description: e.target.value })}
        error={errores.description}
      />
      <TextField
        label="Sitio web"
        opcional
        value={form.url}
        placeholder="https://"
        onChange={(e) => set({ ...form, url: e.target.value })}
        error={errores.url}
      />
      <SelectorImagen
        etiqueta="Logo (opcional)"
        imagen={form.logo}
        alt={form.logoAlt}
        onCambiar={(logo, logoAlt) => set({ ...form, logo, logoAlt })}
        errorAlt={errores.logoAlt}
        ayudaAlt="Normalmente basta con el nombre de la organización, por ejemplo «Logo de la Universidad»."
      />
    </>
  );
}

const colaboradores: Config<Colaborador, FormColaborador> = {
  ruta: "/collaborators",
  titulo: "Colaboradores",
  elemento: "Colaborador",
  vacio: "Aún no hay colaboradores",
  descripcion: (c) => c.description ?? c.url ?? "",
  miniatura: (c) => c.logo?.url ?? null,
  aFormulario: (c) => ({
    name: c?.name ?? "",
    description: c?.description ?? "",
    url: c?.url ?? "",
    logo: c?.logo ? { id: c.logo.id, url: c.logo.url } : null,
    logoAlt: c?.logoAlt ?? "",
  }),
  aCuerpo: (f) => ({
    name: f.name,
    description: f.description || null,
    url: f.url || null,
    logoId: f.logo?.id ?? null,
    logoAlt: f.logo ? f.logoAlt : null,
  }),
  Campos: CamposColaborador,
};

export default function Equipo() {
  const h1 = usePanelPage("Equipo y colaboradores");
  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Equipo y colaboradores"
        descripcion="Personas y organizaciones que aparecen en la página «Nosotros»."
      />
      <Coleccion c={equipo} />
      <Coleccion c={colaboradores} />
    </div>
  );
}
