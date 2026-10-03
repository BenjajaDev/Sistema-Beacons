import type { JSONContent } from "@tiptap/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { docSchema, renderDoc } from "@server-rich-text";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button, IconButton } from "@shared/ui/Button";
import { ConfirmDialog, Dialog } from "@shared/ui/Dialog";
import { ErrorSummary } from "@shared/ui/ErrorSummary";
import { TextArea, TextField } from "@shared/ui/Field";
import { Cargando, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { RENDERIZADORES } from "../../public/sections";
import "../../public/landing.css";
import { adminFetch, type Seccion } from "../api";
import { useAuth } from "../auth";
import { RichTextEditor } from "../editor/RichTextEditor";
import { AvisoCambiosSinGuardar, Cabecera, formatoFecha, usePanelPage } from "../ui";
import { estadoSeccion } from "./Secciones";

// --- Descripción de los campos de cada sección (espejo de server/src/content/sections.ts) ---

type Campo =
  | {
      tipo: "texto";
      clave: string;
      etiqueta: string;
      max: number;
      opcional?: boolean;
      multilinea?: boolean;
      ayuda?: string;
    }
  | { tipo: "enlace"; clave: string; etiqueta: string; opcional?: boolean }
  | { tipo: "lista"; clave: string; etiqueta: string; elemento: string; min: number; max: number }
  | { tipo: "rico"; clave: string; etiqueta: string };

const titulo: Campo = { tipo: "texto", clave: "titulo", etiqueta: "Título", max: 120 };
const intro: Campo = {
  tipo: "texto",
  clave: "intro",
  etiqueta: "Introducción",
  max: 400,
  opcional: true,
  multilinea: true,
};

const CAMPOS: Record<string, Campo[]> = {
  hero: [
    {
      tipo: "texto",
      clave: "antetitulo",
      etiqueta: "Antetítulo",
      max: 60,
      opcional: true,
      ayuda: "Frase corta sobre el título.",
    },
    titulo,
    { tipo: "texto", clave: "bajada", etiqueta: "Bajada", max: 300, multilinea: true },
    { tipo: "enlace", clave: "accionPrincipal", etiqueta: "Botón principal" },
    { tipo: "enlace", clave: "accionSecundaria", etiqueta: "Botón secundario", opcional: true },
  ],
  "que-es": [
    titulo,
    intro,
    { tipo: "lista", clave: "pasos", etiqueta: "Pasos", elemento: "Paso", min: 3, max: 3 },
  ],
  objetivos: [
    titulo,
    intro,
    { tipo: "lista", clave: "items", etiqueta: "Objetivos", elemento: "Objetivo", min: 1, max: 8 },
  ],
  proyecciones: [
    titulo,
    intro,
    {
      tipo: "lista",
      clave: "items",
      etiqueta: "Proyecciones",
      elemento: "Proyección",
      min: 1,
      max: 8,
    },
  ],
  "noticias-recientes": [
    titulo,
    intro,
    { tipo: "texto", clave: "textoVerTodas", etiqueta: "Texto del enlace «ver todas»", max: 40 },
  ],
  "quienes-somos": [titulo, { tipo: "rico", clave: "cuerpo", etiqueta: "Texto" }],
  equipo: [titulo, intro],
  colaboradores: [titulo, intro],
  noticias: [titulo, intro],
  contacto: [
    titulo,
    intro,
    { tipo: "texto", clave: "formularioTitulo", etiqueta: "Título del formulario", max: 80 },
    {
      tipo: "texto",
      clave: "mensajeExito",
      etiqueta: "Mensaje al enviar",
      max: 200,
      multilinea: true,
      ayuda: "Lo que lee la persona después de enviar el formulario.",
    },
  ],
};

type Contenido = Record<string, unknown>;
type Item = { titulo: string; texto: string };
type EnlaceValor = { texto: string; href: string };

const idDe = (ruta: string) => `campo-${ruta.replaceAll(".", "-")}`;

export default function SeccionEditor() {
  const { key = "" } = useParams();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin", "seccion", key],
    queryFn: () => adminFetch<{ section: Seccion }>(`/sections/${key}`),
  });
  if (isPending) {
    return (
      <div className="vista-contenido">
        <Cargando etiqueta="Cargando la sección…">
          <Skeleton alto="20rem" />
        </Cargando>
      </div>
    );
  }
  if (error) {
    return (
      <div className="vista-contenido">
        <ErrorState
          titulo="No pudimos abrir la sección"
          mensaje={mensajeDeError(error)}
          onReintentar={() => refetch()}
        />
        <p>
          <Link to="/secciones">Volver a Secciones</Link>
        </p>
      </div>
    );
  }
  return (
    <Editor
      key={data.section.key + data.section.draftUpdatedAt + data.section.publishedAt}
      seccion={data.section}
    />
  );
}

function Editor({ seccion }: { seccion: Seccion }) {
  const { tiene, usuario } = useAuth();
  const admin = tiene("ADMIN");
  const toast = useToast();
  const queryClient = useQueryClient();
  const h1 = usePanelPage(`Sección: ${seccion.nombre}`);
  const campos = CAMPOS[seccion.key] ?? [];

  const inicial = useMemo(() => seccion.draftContent ?? seccion.content, [seccion]);
  const [contenido, setContenido] = useState<Contenido>(inicial);
  const [base, setBase] = useState(JSON.stringify(inicial));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [devolver, setDevolver] = useState(false);
  const [nota, setNota] = useState("");
  const [descartar, setDescartar] = useState(false);
  const sucio = JSON.stringify(contenido) !== base;

  const enRevision = seccion.draftStatus === "REVIEW";
  const puedeEditar = admin || !enRevision;
  const set = (clave: string, valor: unknown) => setContenido((c) => ({ ...c, [clave]: valor }));

  function refrescar(s: Seccion) {
    queryClient.setQueryData(["admin", "seccion", s.key], { section: s });
    queryClient.invalidateQueries({ queryKey: ["admin", "secciones"] });
  }

  function aplicarError(err: unknown, accion: string) {
    if (err instanceof ApiError && Object.keys(err.campos).length) {
      setErrores(Object.fromEntries(Object.entries(err.campos).map(([r, m]) => [idDe(r), m])));
    } else {
      toast.error(`${accion}: ${mensajeDeError(err)}`);
    }
  }

  async function guardar(silencioso = false): Promise<boolean> {
    if (!sucio) return true;
    setOcupado("guardar");
    try {
      const { section } = await adminFetch<{ section: Seccion }>(`/sections/${seccion.key}/draft`, {
        method: "PUT",
        body: { content: contenido },
      });
      setBase(JSON.stringify(contenido));
      setErrores({});
      if (!silencioso) toast.exito("Borrador guardado. Aún no se ve en el sitio.");
      refrescar(section);
      return true;
    } catch (err) {
      aplicarError(err, "No se pudo guardar");
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function accion(ruta: string, nombre: string, exito: string, body?: unknown) {
    if (!(await guardar(true))) return;
    setOcupado(nombre);
    try {
      const { section } = await adminFetch<{ section: Seccion }>(
        `/sections/${seccion.key}/${ruta}`,
        { method: "POST", body },
      );
      setBase(JSON.stringify(contenido));
      toast.exito(exito);
      refrescar(section);
    } catch (err) {
      aplicarError(err, "No se pudo completar la acción");
    } finally {
      setOcupado(null);
    }
  }

  async function descartarBorrador() {
    const { section } = await adminFetch<{ section: Seccion }>(`/sections/${seccion.key}/draft`, {
      method: "DELETE",
    });
    setBase(JSON.stringify(section.content));
    setContenido(section.content);
    toast.exito("Cambios descartados: queda lo publicado.");
    refrescar(section);
  }

  // Vista previa con el mismo componente que usa la landing.
  const Vista = RENDERIZADORES[seccion.key];
  const contenidoVista = useMemo(() => {
    if (seccion.key !== "quienes-somos") return contenido;
    const cuerpo = contenido.cuerpo as { json?: unknown } | undefined;
    const doc = docSchema.safeParse(cuerpo?.json);
    return { ...contenido, cuerpo: { html: doc.success ? renderDoc(doc.data) : "" } };
  }, [contenido, seccion.key]);

  const esAutora = seccion.draftAuthor?.id === usuario?.id;

  return (
    <div className="vista-contenido">
      <AvisoCambiosSinGuardar sucio={sucio} />
      <Cabecera
        refH1={h1}
        titulo={seccion.nombre}
        descripcion={
          <>
            {estadoSeccion(seccion)}
            {seccion.draftUpdatedAt &&
              ` · borrador de ${seccion.draftAuthor?.name ?? "—"}, ${formatoFecha(seccion.draftUpdatedAt)}`}
            {!seccion.visible && " · oculta en el sitio"}
          </>
        }
        acciones={
          <Link to="/secciones" className="btn btn--fantasma">
            Volver a Secciones
          </Link>
        }
      />
      {seccion.reviewNote && seccion.draftStatus === "DRAFT" && (
        <div className="aviso-panel aviso-panel--aviso">
          <p>
            <strong>Observaciones de administración:</strong> {seccion.reviewNote}
          </p>
        </div>
      )}
      {!puedeEditar && (
        <p className="aviso-panel aviso-panel--info">
          Estos cambios están en revisión. Podrás seguir editando cuando una persona administradora
          los publique o los devuelva.
        </p>
      )}
      <ErrorSummary
        errores={Object.entries(errores).map(([campoId, mensaje]) => ({ campoId, mensaje }))}
      />

      <div className="editor-seccion">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <fieldset disabled={!puedeEditar} className="sin-borde">
            {campos.map((c) => (
              <CampoSeccion
                key={c.clave}
                campo={c}
                valor={contenido[c.clave]}
                onCambiar={(v) => set(c.clave, v)}
                errores={errores}
                soloLectura={!puedeEditar}
              />
            ))}
          </fieldset>
          <div className="fila-botones">
            {puedeEditar && (
              <Button type="submit" cargando={ocupado === "guardar"} textoCargando="Guardando…">
                {sucio ? "Guardar borrador" : "Sin cambios por guardar"}
              </Button>
            )}
            {!admin &&
              seccion.draftStatus !== "REVIEW" &&
              (sucio || seccion.draftStatus === "DRAFT") && (
                <Button
                  variante="secundario"
                  cargando={ocupado === "submit"}
                  textoCargando="Enviando…"
                  onClick={() => accion("submit", "submit", "Cambios enviados a revisión.")}
                >
                  Enviar a revisión
                </Button>
              )}
            {admin && (sucio || seccion.draftStatus) && (
              <Button
                variante="secundario"
                cargando={ocupado === "publish"}
                textoCargando="Publicando…"
                onClick={() =>
                  accion("publish", "publish", "Sección publicada: ya se ve en el sitio.")
                }
              >
                Publicar cambios
              </Button>
            )}
            {admin && enRevision && (
              <Button variante="secundario" onClick={() => setDevolver(true)}>
                Devolver con observaciones
              </Button>
            )}
            {seccion.draftStatus && (admin || (esAutora && !enRevision)) && (
              <Button variante="fantasma" onClick={() => setDescartar(true)}>
                Descartar cambios
              </Button>
            )}
          </div>
        </form>

        <section className="vista-previa-seccion" aria-labelledby="titulo-vista-previa">
          <h2 id="titulo-vista-previa" className="vista-previa-seccion__titulo">
            Vista previa
          </h2>
          <div className={`seccion seccion--${seccion.key} vista-previa-seccion__marco`}>
            {Vista ? (
              <Vista
                contenido={contenidoVista as never}
                nivel={2}
                idTitulo="vista-previa-seccion"
              />
            ) : (
              <p>Esta sección no tiene vista previa.</p>
            )}
          </div>
        </section>
      </div>

      <Dialog
        abierto={devolver}
        onCerrar={() => setDevolver(false)}
        titulo="Devolver con observaciones"
        acciones={
          <>
            <Button variante="secundario" onClick={() => setDevolver(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!nota.trim()) return;
                await accion("reject", "reject", "Cambios devueltos con tus observaciones.", {
                  note: nota,
                });
                setDevolver(false);
              }}
            >
              Devolver
            </Button>
          </>
        }
      >
        <TextArea
          label="Observaciones"
          rows={4}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          data-autofocus
        />
      </Dialog>
      <ConfirmDialog
        abierto={descartar}
        onCerrar={() => setDescartar(false)}
        titulo="¿Descartar los cambios?"
        mensaje="Se borrará el borrador y la sección quedará como está publicada."
        textoConfirmar="Descartar cambios"
        onConfirmar={() =>
          descartarBorrador().catch((err) =>
            toast.error(`No se pudo descartar. ${mensajeDeError(err)}`),
          )
        }
      />
    </div>
  );
}

function CampoSeccion({
  campo,
  valor,
  onCambiar,
  errores,
  soloLectura,
}: {
  campo: Campo;
  valor: unknown;
  onCambiar: (v: unknown) => void;
  errores: Record<string, string>;
  soloLectura: boolean;
}) {
  const id = idDe(campo.clave);
  if (campo.tipo === "texto") {
    const v = (valor as string | undefined) ?? "";
    const props = {
      id,
      label: campo.etiqueta,
      opcional: campo.opcional,
      value: v,
      maxLength: campo.max,
      ayuda: [campo.ayuda, `${v.length} de ${campo.max} caracteres.`].filter(Boolean).join(" "),
      error: errores[id],
      onChange: (e: { target: { value: string } }) =>
        onCambiar(campo.opcional && !e.target.value ? undefined : e.target.value),
    };
    return campo.multilinea ? <TextArea {...props} rows={3} /> : <TextField {...props} />;
  }
  if (campo.tipo === "enlace") {
    const v = valor as EnlaceValor | undefined;
    return (
      <fieldset className="grupo-campos">
        <legend>
          {campo.etiqueta}
          {campo.opcional && <span className="campo__opcional"> (opcional)</span>}
        </legend>
        {campo.opcional && (
          <label className="casilla">
            <input
              type="checkbox"
              checked={Boolean(v)}
              onChange={(e) => onCambiar(e.target.checked ? { texto: "", href: "" } : undefined)}
            />
            Mostrar este botón
          </label>
        )}
        {v && (
          <>
            <TextField
              id={`${id}-texto`}
              label="Texto del botón"
              maxLength={40}
              value={v.texto}
              error={errores[`${id}-texto`]}
              onChange={(e) => onCambiar({ ...v, texto: e.target.value })}
            />
            <TextField
              id={`${id}-href`}
              label="Destino"
              ayuda="Una página del sitio (/contacto), una sección de esta página (#que-es) o una dirección https://."
              value={v.href}
              error={errores[`${id}-href`]}
              onChange={(e) => onCambiar({ ...v, href: e.target.value })}
            />
          </>
        )}
      </fieldset>
    );
  }
  if (campo.tipo === "lista") {
    const items = (valor as Item[] | undefined) ?? [];
    const fija = campo.min === campo.max;
    const cambiarItem = (i: number, cambio: Partial<Item>) =>
      onCambiar(items.map((it, j) => (j === i ? { ...it, ...cambio } : it)));
    const mover = (i: number, d: number) => {
      const copia = [...items];
      [copia[i], copia[i + d]] = [copia[i + d]!, copia[i]!];
      onCambiar(copia);
    };
    return (
      <fieldset className="grupo-campos">
        <legend>{campo.etiqueta}</legend>
        {errores[id] && <p className="campo__error">{errores[id]}</p>}
        <ol className="lista-items">
          {items.map((it, i) => (
            <li key={i}>
              <fieldset className="grupo-campos grupo-campos--item">
                <legend>
                  {campo.elemento} {i + 1}
                </legend>
                <TextField
                  id={`${id}-${i}-titulo`}
                  label="Título"
                  maxLength={80}
                  value={it.titulo}
                  error={errores[`${id}-${i}-titulo`]}
                  onChange={(e) => cambiarItem(i, { titulo: e.target.value })}
                />
                <TextArea
                  id={`${id}-${i}-texto`}
                  label="Texto"
                  rows={2}
                  maxLength={400}
                  value={it.texto}
                  error={errores[`${id}-${i}-texto`]}
                  onChange={(e) => cambiarItem(i, { texto: e.target.value })}
                />
                {!soloLectura && (
                  <div className="fila-botones">
                    <IconButton
                      label={`Subir ${campo.elemento.toLowerCase()} ${i + 1}`}
                      aria-disabled={i === 0 || undefined}
                      onClick={() => i > 0 && mover(i, -1)}
                    >
                      <span aria-hidden="true">↑</span>
                    </IconButton>
                    <IconButton
                      label={`Bajar ${campo.elemento.toLowerCase()} ${i + 1}`}
                      aria-disabled={i === items.length - 1 || undefined}
                      onClick={() => i < items.length - 1 && mover(i, 1)}
                    >
                      <span aria-hidden="true">↓</span>
                    </IconButton>
                    {!fija && items.length > campo.min && (
                      <Button
                        variante="fantasma"
                        onClick={() => onCambiar(items.filter((_, j) => j !== i))}
                      >
                        Quitar {campo.elemento.toLowerCase()} {i + 1}
                      </Button>
                    )}
                  </div>
                )}
              </fieldset>
            </li>
          ))}
        </ol>
        {!fija && !soloLectura && items.length < campo.max && (
          <Button
            variante="secundario"
            onClick={() => onCambiar([...items, { titulo: "", texto: "" }])}
          >
            Agregar {campo.elemento.toLowerCase()}
          </Button>
        )}
      </fieldset>
    );
  }
  const rico = valor as { json?: JSONContent } | undefined;
  return (
    <RichTextEditor
      etiqueta={campo.etiqueta}
      barra="reducida"
      valor={rico?.json ?? { type: "doc", content: [] }}
      onCambiar={(json) => onCambiar({ json })}
      error={errores[idDe(`${campo.clave}.json`)] ?? errores[id]}
      soloLectura={soloLectura}
    />
  );
}
