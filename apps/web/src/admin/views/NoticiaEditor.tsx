import type { JSONContent } from "@tiptap/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate, useParams } from "react-router";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { ConfirmDialog, Dialog } from "@shared/ui/Dialog";
import { ErrorSummary } from "@shared/ui/ErrorSummary";
import { TextArea, TextField } from "@shared/ui/Field";
import { Cargando, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { adminFetch, type InformeAccesibilidad, type Noticia } from "../api";
import { useAuth } from "../auth";
import { RichTextEditor } from "../editor/RichTextEditor";
import {
  AvisoCambiosSinGuardar,
  Cabecera,
  Estado,
  formatoFecha,
  SelectorImagen,
  usePanelPage,
  type ImagenElegida,
} from "../ui";

interface Formulario {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  cover: ImagenElegida | null;
  coverAlt: string;
  bodyJson: JSONContent;
}

const VACIO: Formulario = {
  title: "",
  slug: "",
  excerpt: "",
  category: "",
  cover: null,
  coverAlt: "",
  bodyJson: { type: "doc", content: [] },
};

const NOMBRES_CAMPO: Record<string, string> = {
  title: "titulo",
  slug: "slug",
  excerpt: "bajada",
  category: "categoria",
  coverAlt: "portada-alt",
  coverId: "portada-alt",
};

function desdeNoticia(n: Noticia): Formulario {
  return {
    title: n.title,
    slug: n.slug,
    excerpt: n.excerpt,
    category: n.category,
    cover: n.cover ? { id: n.cover.id, url: n.cover.url } : null,
    coverAlt: n.coverAlt ?? "",
    bodyJson: (n.bodyJson as JSONContent) ?? VACIO.bodyJson,
  };
}

// Copia local del formulario: si se cierra la pestaña o se cae la conexión, lo
// escrito se puede recuperar al volver.
const claveLocal = (id: string | undefined) => `signal-noticia-${id ?? "nueva"}`;
function leerLocal(id: string | undefined): { guardado: number; datos: Formulario } | null {
  try {
    return JSON.parse(localStorage.getItem(claveLocal(id)) ?? "null");
  } catch {
    return null;
  }
}

export default function NoticiaEditor() {
  const { id } = useParams();
  const esNueva = !id;
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin", "noticia", id],
    queryFn: () => adminFetch<{ news: Noticia }>(`/news/${id}`),
    enabled: !esNueva,
  });

  if (!esNueva && isPending) {
    return (
      <div className="vista-contenido">
        <Cargando etiqueta="Cargando la noticia…">
          <Skeleton alto="3rem" ancho="60%" />
          <Skeleton alto="20rem" style={{ marginTop: "1rem" }} />
        </Cargando>
      </div>
    );
  }
  if (!esNueva && error) {
    return (
      <div className="vista-contenido">
        <ErrorState
          titulo="No pudimos abrir la noticia"
          mensaje={mensajeDeError(error)}
          onReintentar={() => refetch()}
        />
        <p>
          <Link to="/noticias">Volver a Noticias</Link>
        </p>
      </div>
    );
  }
  // key: al pasar de «nueva» a guardada, el formulario se reinicia con los datos del servidor.
  return <Editor key={id ?? "nueva"} noticia={data?.news ?? null} />;
}

function Editor({ noticia }: { noticia: Noticia | null }) {
  const { usuario, tiene } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const admin = tiene("ADMIN");
  const id = noticia?.id;

  const inicial = useMemo(() => (noticia ? desdeNoticia(noticia) : VACIO), [noticia]);
  const [form, setForm] = useState<Formulario>(inicial);
  const [guardadoBase, setGuardadoBase] = useState(JSON.stringify(inicial));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [informe, setInforme] = useState<InformeAccesibilidad | null>(
    noticia?.accesibilidad ?? null,
  );
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [devolver, setDevolver] = useState(false);
  const [nota, setNota] = useState("");
  const [errorNota, setErrorNota] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<"borrar" | "despublicar" | null>(null);
  const [recuperable, setRecuperable] = useState(() => {
    const local = leerLocal(id);
    const servidor = noticia ? new Date(noticia.updatedAt).getTime() : 0;
    return local &&
      local.guardado > servidor &&
      JSON.stringify(local.datos) !== JSON.stringify(inicial)
      ? local
      : null;
  });

  const h1 = usePanelPage(noticia ? `Editar: ${noticia.title}` : "Nueva noticia");
  const sucio = JSON.stringify(form) !== guardadoBase;

  const puedeEditar =
    !noticia || admin || (noticia.author.id === usuario?.id && noticia.status === "DRAFT");
  const motivoBloqueo = !puedeEditar
    ? noticia?.status === "REVIEW"
      ? "Esta nota está en revisión. Un administrador debe publicarla o devolverla antes de poder editarla."
      : noticia?.status === "PUBLISHED"
        ? "Esta nota ya está publicada. Pide a un administrador que la despublique para editarla."
        : "Solo puedes editar las notas que escribiste."
    : null;

  const { data: categorias } = useQuery({
    queryKey: ["admin", "categorias"],
    queryFn: () => adminFetch<{ categorias: string[] }>("/news/categories"),
  });

  // Copia local mientras hay cambios sin guardar.
  useEffect(() => {
    if (!sucio || !puedeEditar) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(claveLocal(id), JSON.stringify({ guardado: Date.now(), datos: form }));
      } catch {
        // Sin almacenamiento local: el aviso al salir sigue protegiendo los cambios.
      }
    }, 800);
    return () => clearTimeout(t);
  }, [form, sucio, puedeEditar, id]);

  const set = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  function cuerpo() {
    return {
      title: form.title,
      excerpt: form.excerpt,
      category: form.category,
      bodyJson: form.bodyJson,
      coverId: form.cover?.id ?? null,
      coverAlt: form.cover ? form.coverAlt : null,
      ...(form.slug && (!noticia || !noticia.publishedAt) && { slug: form.slug }),
    };
  }

  function aplicarError(err: unknown, accion: string) {
    if (err instanceof ApiError) {
      setErrores(
        Object.fromEntries(Object.entries(err.campos).map(([c, m]) => [NOMBRES_CAMPO[c] ?? c, m])),
      );
      if (err.extra.accesibilidad) setInforme(err.extra.accesibilidad as InformeAccesibilidad);
      if (!Object.keys(err.campos).length) toast.error(`${accion}: ${err.message}`);
    } else {
      toast.error(`${accion}: ${mensajeDeError(err)}`);
    }
  }

  function despuesDeGuardar(n: Noticia) {
    const nuevo = desdeNoticia(n);
    setForm(nuevo);
    setGuardadoBase(JSON.stringify(nuevo));
    setInforme(n.accesibilidad);
    setErrores({});
    try {
      localStorage.removeItem(claveLocal(id));
      localStorage.removeItem(claveLocal(undefined));
    } catch {
      // nada
    }
    queryClient.setQueryData(["admin", "noticia", n.id], { news: n });
    queryClient.invalidateQueries({ queryKey: ["admin", "noticias"] });
  }

  // Guarda (si hace falta) y devuelve la noticia vigente.
  async function guardar(silencioso = false): Promise<Noticia | null> {
    if (!form.title.trim()) {
      setErrores({ titulo: "Escribe un título para poder guardar." });
      return null;
    }
    if (noticia && !sucio) return noticia;
    setOcupado("guardar");
    try {
      const { news } = noticia
        ? await adminFetch<{ news: Noticia }>(`/news/${noticia.id}`, {
            method: "PATCH",
            body: cuerpo(),
          })
        : await adminFetch<{ news: Noticia }>("/news", { method: "POST", body: cuerpo() });
      // flushSync: el estado «guardado» debe aplicarse antes de navegar, o el aviso
      // de cambios sin guardar bloquearía la navegación a la nota recién creada.
      flushSync(() => despuesDeGuardar(news));
      if (!silencioso) toast.exito("Borrador guardado.");
      if (!noticia) navigate(`/noticias/${news.id}`, { replace: true });
      return news;
    } catch (err) {
      aplicarError(err, "No se pudo guardar");
      return null;
    } finally {
      setOcupado(null);
    }
  }

  async function accion(ruta: string, nombre: string, exito: string, body?: unknown) {
    const vigente = await guardar(true);
    if (!vigente) return;
    setOcupado(nombre);
    try {
      const { news } = await adminFetch<{ news: Noticia }>(`/news/${vigente.id}/${ruta}`, {
        method: "POST",
        body,
      });
      flushSync(() => despuesDeGuardar(news));
      toast.exito(exito);
      if (!noticia) navigate(`/noticias/${news.id}`, { replace: true });
    } catch (err) {
      aplicarError(err, "No se pudo completar la acción");
    } finally {
      setOcupado(null);
    }
  }

  async function borrar() {
    if (!noticia) return;
    await adminFetch(`/news/${noticia.id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["admin", "noticias"] });
    flushSync(() => setGuardadoBase(JSON.stringify(form)));
    toast.exito("Noticia borrada.");
    navigate("/noticias", { replace: true });
  }

  const listaErrores = Object.entries(errores).map(([campoId, mensaje]) => ({ campoId, mensaje }));
  const estado = noticia?.status ?? "DRAFT";
  const puedeBorrar =
    noticia &&
    (admin || (noticia.author.id === usuario?.id && estado === "DRAFT" && !noticia.publishedAt));

  return (
    <div className="vista-contenido editor-noticia">
      <AvisoCambiosSinGuardar sucio={sucio && puedeEditar} />
      <Cabecera
        refH1={h1}
        titulo={noticia ? "Editar noticia" : "Nueva noticia"}
        descripcion={
          noticia ? (
            <>
              <Estado estado={estado} /> · {noticia.author.name} · última edición{" "}
              {formatoFecha(noticia.updatedAt)}
            </>
          ) : (
            "Guarda el borrador cuando quieras: puedes terminarla después."
          )
        }
      />

      {recuperable && (
        <div className="aviso-panel aviso-panel--info" role="status">
          <p>
            Hay cambios sin guardar de esta nota del{" "}
            {formatoFecha(new Date(recuperable.guardado).toISOString())}.
          </p>
          <div className="fila-botones">
            <Button
              variante="secundario"
              onClick={() => {
                setForm(recuperable.datos);
                setRecuperable(null);
              }}
            >
              Recuperar esos cambios
            </Button>
            <Button
              variante="fantasma"
              onClick={() => {
                localStorage.removeItem(claveLocal(noticia?.id));
                setRecuperable(null);
              }}
            >
              Descartarlos
            </Button>
          </div>
        </div>
      )}
      {noticia?.reviewNote && estado === "DRAFT" && (
        <div className="aviso-panel aviso-panel--aviso">
          <p>
            <strong>Observaciones de {noticia.reviewer?.name ?? "administración"}:</strong>{" "}
            {noticia.reviewNote}
          </p>
        </div>
      )}
      {motivoBloqueo && <p className="aviso-panel aviso-panel--info">{motivoBloqueo}</p>}

      <ErrorSummary errores={listaErrores} />

      <div className="editor-noticia__rejilla">
        <form
          className="editor-noticia__campos"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <fieldset disabled={!puedeEditar} className="sin-borde">
            <TextField
              id="titulo"
              label="Título"
              value={form.title}
              maxLength={160}
              onChange={(e) => set("title", e.target.value)}
              error={errores.titulo}
            />
            <TextArea
              id="bajada"
              label="Bajada"
              ayuda={`Resumen de una o dos frases. Se muestra en las tarjetas y al compartir. ${form.excerpt.length} de 300 caracteres.`}
              rows={3}
              maxLength={300}
              value={form.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              error={errores.bajada}
            />
            <TextField
              id="categoria"
              label="Categoría"
              list="categorias-noticias"
              value={form.category}
              maxLength={60}
              onChange={(e) => set("category", e.target.value)}
              error={errores.categoria}
            />
            <datalist id="categorias-noticias">
              {categorias?.categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {(!noticia || !noticia.publishedAt) && (
              <TextField
                id="slug"
                label="Dirección de la nota"
                opcional
                ayuda={`Se arma con el título si la dejas vacía. Solo minúsculas, números y guiones. Quedará en /noticias/${form.slug || "…"} y no se puede cambiar después de publicar.`}
                value={form.slug}
                maxLength={80}
                onChange={(e) => set("slug", e.target.value.toLowerCase())}
                error={errores.slug}
              />
            )}
          </fieldset>
          {puedeEditar ? (
            <SelectorImagen
              etiqueta="Imagen de portada (opcional)"
              imagen={form.cover}
              alt={form.coverAlt}
              onCambiar={(img, alt) => setForm((f) => ({ ...f, cover: img, coverAlt: alt }))}
              errorAlt={errores["portada-alt"]}
            />
          ) : (
            form.cover && (
              <figure>
                <img src={form.cover.url} alt={form.coverAlt} className="selector-imagen__vista" />
                <figcaption className="texto-suave">Texto alternativo: {form.coverAlt}</figcaption>
              </figure>
            )
          )}
          <RichTextEditor
            etiqueta="Cuerpo de la nota"
            valor={form.bodyJson}
            onCambiar={(json) => set("bodyJson", json)}
            soloLectura={!puedeEditar}
            ayuda="Usa subtítulos para ordenar el texto. Cada imagen necesita su texto alternativo."
          />
        </form>

        <aside className="editor-noticia__lateral" aria-label="Acciones y revisión">
          <section className="tarjeta-panel">
            <h2>Acciones</h2>
            <div className="pila-botones">
              {puedeEditar && (
                <Button
                  cargando={ocupado === "guardar"}
                  textoCargando="Guardando…"
                  onClick={() => guardar()}
                >
                  {sucio || !noticia ? "Guardar borrador" : "Guardado"}
                </Button>
              )}
              {noticia &&
                (sucio ? (
                  <p className="campo__ayuda">Guarda los cambios para ver la vista previa.</p>
                ) : (
                  <Link to={`/noticias/${noticia.id}/vista-previa`} className="btn btn--secundario">
                    Vista previa
                  </Link>
                ))}
              {estado === "DRAFT" && puedeEditar && !admin && (
                <Button
                  variante="secundario"
                  cargando={ocupado === "submit"}
                  textoCargando="Enviando…"
                  onClick={() =>
                    accion(
                      "submit",
                      "submit",
                      "Enviada a revisión. Te avisaremos con el resultado en esta pantalla.",
                    )
                  }
                >
                  Enviar a revisión
                </Button>
              )}
              {admin && estado !== "PUBLISHED" && (
                <Button
                  cargando={ocupado === "publish"}
                  textoCargando="Publicando…"
                  onClick={() =>
                    accion("publish", "publish", "Noticia publicada: ya se ve en el sitio.")
                  }
                >
                  Publicar
                </Button>
              )}
              {admin && estado === "REVIEW" && (
                <Button variante="secundario" onClick={() => setDevolver(true)}>
                  Devolver con observaciones
                </Button>
              )}
              {admin && estado === "PUBLISHED" && (
                <Button variante="secundario" onClick={() => setConfirmar("despublicar")}>
                  Despublicar
                </Button>
              )}
              {puedeBorrar && (
                <Button variante="fantasma" onClick={() => setConfirmar("borrar")}>
                  Borrar noticia
                </Button>
              )}
            </div>
          </section>

          <section className="tarjeta-panel" aria-live="polite">
            <h2>Revisión de accesibilidad</h2>
            {!informe ? (
              <p className="texto-suave">Guarda la nota para revisarla.</p>
            ) : informe.errores.length === 0 && informe.advertencias.length === 0 ? (
              <p className="texto-ok">Sin observaciones. ¡Bien hecho!</p>
            ) : (
              <>
                {informe.errores.length > 0 && (
                  <>
                    <h3 className="texto-error">Impiden publicar</h3>
                    <ul>
                      {informe.errores.map((e, i) => (
                        <li key={i}>{e.message}</li>
                      ))}
                    </ul>
                  </>
                )}
                {informe.advertencias.length > 0 && (
                  <>
                    <h3>Recomendaciones</h3>
                    <ul>
                      {informe.advertencias.map((a, i) => (
                        <li key={i}>{a.message}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
            {noticia?.lectura && (
              <p className="texto-suave">
                {noticia.lectura.palabras} palabras · {noticia.lectura.minutosLectura} min de
                lectura
              </p>
            )}
          </section>
        </aside>
      </div>

      <Dialog
        abierto={devolver}
        onCerrar={() => setDevolver(false)}
        titulo="Devolver con observaciones"
        descripcion="La nota vuelve a borrador y quien la escribió verá tus observaciones."
        acciones={
          <>
            <Button variante="secundario" onClick={() => setDevolver(false)}>
              Cancelar
            </Button>
            <Button
              cargando={ocupado === "reject"}
              onClick={async () => {
                if (!nota.trim()) {
                  setErrorNota("Explica qué hay que corregir.");
                  return;
                }
                await accion("reject", "reject", "Nota devuelta con tus observaciones.", {
                  note: nota,
                });
                setDevolver(false);
                setNota("");
              }}
            >
              Devolver nota
            </Button>
          </>
        }
      >
        <TextArea
          label="Observaciones"
          rows={4}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          error={errorNota ?? undefined}
          data-autofocus
        />
      </Dialog>

      <ConfirmDialog
        abierto={confirmar === "borrar"}
        onCerrar={() => setConfirmar(null)}
        titulo="¿Borrar esta noticia?"
        mensaje={`Se eliminará «${noticia?.title}» de forma permanente. No se puede deshacer.`}
        textoConfirmar="Borrar noticia"
        onConfirmar={() =>
          borrar().catch((err) => toast.error(`No se pudo borrar. ${mensajeDeError(err)}`))
        }
      />
      <ConfirmDialog
        abierto={confirmar === "despublicar"}
        onCerrar={() => setConfirmar(null)}
        titulo="¿Despublicar esta noticia?"
        mensaje="Dejará de verse en el sitio y volverá a borrador. Su dirección se mantiene."
        textoConfirmar="Despublicar"
        onConfirmar={() => accion("unpublish", "unpublish", "Noticia despublicada.")}
      />
    </div>
  );
}
