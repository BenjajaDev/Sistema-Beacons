import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { TextArea, TextField } from "@shared/ui/Field";
import { SelectorImagen, type ImagenElegida } from "../ui";
import { adaptarHtmlPegado, crearExtensiones, HREF_VALIDO, type Barra } from "./extensiones";

// Editor de texto enriquecido accesible:
// - el área de escritura tiene nombre (label), descripción y estado de error;
// - la barra es un role="toolbar": un solo Tab para entrar y flechas para moverse;
// - cada botón de formato indica si está activo (aria-pressed) y su atajo.

export interface RichTextEditorProps {
  etiqueta: string;
  valor: JSONContent;
  onCambiar: (json: JSONContent) => void;
  barra?: Barra;
  ayuda?: ReactNode;
  error?: string;
  placeholder?: string;
  // Sin permiso para editar: se muestra el texto, sin barra ni edición.
  soloLectura?: boolean;
}

interface Accion {
  clave: string;
  texto: string;
  atajo?: string;
  activa?: (e: Editor) => boolean;
  ejecutar: (e: Editor) => void;
  barra?: Barra;
  contenido: ReactNode;
}

export function RichTextEditor({
  etiqueta,
  valor,
  onCambiar,
  barra = "completa",
  ayuda,
  error,
  placeholder = "Escribe aquí…",
  soloLectura = false,
}: RichTextEditorProps) {
  const id = useId();
  const ids = {
    etiqueta: `${id}-etiqueta`,
    ayuda: `${id}-ayuda`,
    error: `${id}-error`,
    conteo: `${id}-conteo`,
  };
  const [dialogoEnlace, setDialogoEnlace] = useState(false);
  const [dialogoImagen, setDialogoImagen] = useState(false);

  const atributos = (conError: boolean) => ({
    role: "textbox",
    "aria-multiline": "true",
    "aria-labelledby": ids.etiqueta,
    "aria-describedby": [conError ? ids.error : null, ayuda ? ids.ayuda : null, ids.conteo]
      .filter(Boolean)
      .join(" "),
    ...(conError ? { "aria-invalid": "true" } : {}),
    class: "prosa editor__area",
  });

  const editor = useEditor({
    extensions: crearExtensiones(barra, placeholder),
    content: valor,
    editable: !soloLectura,
    editorProps: { attributes: atributos(Boolean(error)), transformPastedHTML: adaptarHtmlPegado },
    onUpdate: ({ editor }) => onCambiar(editor.getJSON()),
  });

  // El estado de error cambia después de crear el editor: se actualizan sus atributos.
  useEffect(() => {
    editor?.setOptions({
      editorProps: {
        attributes: atributos(Boolean(error)),
        transformPastedHTML: adaptarHtmlPegado,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo depende del error
  }, [editor, error]);

  useEffect(() => {
    editor?.setEditable(!soloLectura);
  }, [editor, soloLectura]);

  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            negrita: e.isActive("bold"),
            cursiva: e.isActive("italic"),
            enlace: e.isActive("link"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            vinetas: e.isActive("bulletList"),
            numerada: e.isActive("orderedList"),
            cita: e.isActive("blockquote"),
            imagen: e.isActive("image"),
            deshacer: e.can().undo(),
            rehacer: e.can().redo(),
            palabras: e.storage.characterCount.words() as number,
          }
        : null,
  });

  const todas: Accion[] = [
    {
      clave: "h2",
      texto: "Subtítulo",
      barra: "completa" as Barra,
      activa: () => Boolean(estado?.h2),
      ejecutar: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
      contenido: "H2",
    },
    {
      clave: "h3",
      texto: "Subtítulo de segundo nivel",
      barra: "completa" as Barra,
      activa: () => Boolean(estado?.h3),
      ejecutar: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
      contenido: "H3",
    },
    {
      clave: "negrita",
      texto: "Negrita",
      atajo: "Ctrl+B",
      activa: () => Boolean(estado?.negrita),
      ejecutar: (e) => e.chain().focus().toggleBold().run(),
      contenido: <strong>B</strong>,
    },
    {
      clave: "cursiva",
      texto: "Cursiva",
      atajo: "Ctrl+I",
      activa: () => Boolean(estado?.cursiva),
      ejecutar: (e) => e.chain().focus().toggleItalic().run(),
      contenido: <em>I</em>,
    },
    {
      clave: "enlace",
      texto: "Enlace",
      atajo: "Ctrl+K",
      activa: () => Boolean(estado?.enlace),
      ejecutar: () => setDialogoEnlace(true),
      contenido: "Enlace",
    },
    {
      clave: "vinetas",
      texto: "Lista con viñetas",
      activa: () => Boolean(estado?.vinetas),
      ejecutar: (e) => e.chain().focus().toggleBulletList().run(),
      contenido: "• Lista",
    },
    {
      clave: "numerada",
      texto: "Lista numerada",
      activa: () => Boolean(estado?.numerada),
      ejecutar: (e) => e.chain().focus().toggleOrderedList().run(),
      contenido: "1. Lista",
    },
    {
      clave: "cita",
      texto: "Cita",
      barra: "completa" as Barra,
      activa: () => Boolean(estado?.cita),
      ejecutar: (e) => e.chain().focus().toggleBlockquote().run(),
      contenido: "Cita",
    },
    {
      clave: "separador",
      texto: "Separador",
      barra: "completa" as Barra,
      ejecutar: (e) => e.chain().focus().setHorizontalRule().run(),
      contenido: "—",
    },
    {
      clave: "imagen",
      texto: estado?.imagen ? "Editar imagen" : "Insertar imagen",
      barra: "completa" as Barra,
      ejecutar: () => setDialogoImagen(true),
      contenido: "Imagen",
    },
    {
      clave: "limpiar",
      texto: "Quitar formato",
      ejecutar: (e) => e.chain().focus().unsetAllMarks().clearNodes().run(),
      contenido: "Limpiar",
    },
    {
      clave: "deshacer",
      texto: "Deshacer",
      atajo: "Ctrl+Z",
      ejecutar: (e) => e.chain().focus().undo().run(),
      contenido: "↶",
    },
    {
      clave: "rehacer",
      texto: "Rehacer",
      atajo: "Ctrl+Shift+Z",
      ejecutar: (e) => e.chain().focus().redo().run(),
      contenido: "↷",
    },
  ];
  const acciones = todas.filter((a) => !a.barra || a.barra === barra);

  // Barra con tabindex itinerante: Tab entra a un solo botón; las flechas recorren.
  const [actual, setActual] = useState(0);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  function moverFoco(e: KeyboardEvent) {
    const destino = {
      ArrowRight: (actual + 1) % acciones.length,
      ArrowLeft: (actual - 1 + acciones.length) % acciones.length,
      Home: 0,
      End: acciones.length - 1,
    }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    setActual(destino);
    botones.current[destino]?.focus();
  }

  // Ctrl+K abre el diálogo de enlace desde el área de escritura.
  function atajos(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setDialogoEnlace(true);
    }
  }

  return (
    <div className={`editor ${error ? "editor--error" : ""}`}>
      <span className="campo__label" id={ids.etiqueta}>
        {etiqueta}
      </span>
      {ayuda && (
        <div className="campo__ayuda" id={ids.ayuda}>
          {ayuda}
        </div>
      )}
      {!soloLectura && (
        <div
          role="toolbar"
          aria-label={`Formato de «${etiqueta}»`}
          className="editor__barra"
          onKeyDown={moverFoco}
        >
          {acciones.map((a, i) => (
            <button
              key={a.clave}
              ref={(el) => {
                botones.current[i] = el;
              }}
              type="button"
              className="editor__boton"
              tabIndex={i === actual ? 0 : -1}
              aria-label={a.atajo ? `${a.texto} (${a.atajo})` : a.texto}
              title={a.atajo ? `${a.texto} (${a.atajo})` : a.texto}
              aria-pressed={a.activa ? a.activa(editor!) : undefined}
              aria-disabled={
                (a.clave === "deshacer" && !estado?.deshacer) ||
                (a.clave === "rehacer" && !estado?.rehacer) ||
                undefined
              }
              onFocus={() => setActual(i)}
              onClick={() => editor && a.ejecutar(editor)}
            >
              {a.contenido}
            </button>
          ))}
        </div>
      )}
      {/* El área editable es el propio contenido de TipTap (role="textbox"). */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- atajo de teclado sobre el editor */}
      <div onKeyDown={atajos}>
        <EditorContent editor={editor} />
      </div>
      {error && (
        <p className="campo__error" id={ids.error}>
          {error}
        </p>
      )}
      <p className="campo__ayuda" id={ids.conteo}>
        {estado?.palabras ?? 0} palabras
      </p>
      {editor && (
        <>
          <DialogoEnlace
            editor={editor}
            abierto={dialogoEnlace}
            onCerrar={() => setDialogoEnlace(false)}
          />
          {barra === "completa" && (
            <DialogoImagen
              editor={editor}
              abierto={dialogoImagen}
              onCerrar={() => setDialogoImagen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

// Los diálogos se montan de nuevo en cada apertura (key): su estado inicial sale
// del editor en ese momento, sin efectos que lo sincronicen.
function DialogoEnlace({
  editor,
  abierto,
  onCerrar,
}: {
  editor: Editor;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const [apertura, setApertura] = useState(0);
  const [antes, setAntes] = useState(abierto);
  if (abierto !== antes) {
    setAntes(abierto);
    if (abierto) setApertura((n) => n + 1);
  }
  return (
    <Dialog
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Enlace"
      descripcion="El texto del enlace debe decir adónde lleva. Evita «clic aquí»."
    >
      <ContenidoEnlace key={apertura} editor={editor} onCerrar={onCerrar} />
    </Dialog>
  );
}

function ContenidoEnlace({ editor, onCerrar }: { editor: Editor; onCerrar: () => void }) {
  const [href, setHref] = useState(
    () => (editor.getAttributes("link").href as string | undefined) ?? "",
  );
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sinSeleccion = editor.state.selection.empty && !editor.isActive("link");

  function guardar() {
    const url = href.trim();
    if (!HREF_VALIDO.test(url)) {
      setError(
        "Escribe una dirección que empiece con https://, mailto: o tel:, o una ruta del sitio como /contacto.",
      );
      return;
    }
    if (sinSeleccion && !texto.trim()) {
      setError("Escribe el texto del enlace: debe decir adónde lleva.");
      return;
    }
    const cadena = editor.chain().focus();
    if (sinSeleccion) {
      cadena
        .insertContent({
          type: "text",
          text: texto.trim(),
          marks: [{ type: "link", attrs: { href: url } }],
        })
        .run();
    } else {
      cadena.extendMarkRange("link").setLink({ href: url }).run();
    }
    onCerrar();
  }

  return (
    <>
      <TextField
        label="Dirección"
        value={href}
        onChange={(e) => setHref(e.target.value)}
        placeholder="https://"
        error={error ?? undefined}
        data-autofocus
      />
      {sinSeleccion && (
        <TextField
          label="Texto del enlace"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      )}
      <div className="dialogo__acciones">
        {editor.isActive("link") && (
          <Button
            variante="fantasma"
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              onCerrar();
            }}
          >
            Quitar enlace
          </Button>
        )}
        <Button variante="secundario" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button onClick={guardar}>Guardar enlace</Button>
      </div>
    </>
  );
}

function DialogoImagen({
  editor,
  abierto,
  onCerrar,
}: {
  editor: Editor;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const [apertura, setApertura] = useState(0);
  const [antes, setAntes] = useState(abierto);
  if (abierto !== antes) {
    setAntes(abierto);
    if (abierto) setApertura((n) => n + 1);
  }
  const editando = editor.isActive("image");
  return (
    <Dialog
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? "Editar imagen" : "Insertar imagen"}
    >
      <ContenidoImagen key={apertura} editor={editor} editando={editando} onCerrar={onCerrar} />
    </Dialog>
  );
}

function ContenidoImagen({
  editor,
  editando,
  onCerrar,
}: {
  editor: Editor;
  editando: boolean;
  onCerrar: () => void;
}) {
  const actual = editando
    ? (editor.getAttributes("image") as { src?: string; alt?: string; caption?: string })
    : {};
  const [imagen, setImagen] = useState<ImagenElegida | null>(
    actual.src ? { id: "", url: actual.src } : null,
  );
  const [alt, setAlt] = useState(actual.alt ?? "");
  const [pie, setPie] = useState(actual.caption ?? "");
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    if (!imagen) {
      setError("Sube o elige una imagen.");
      return;
    }
    if (!alt.trim()) {
      setError("Escribe el texto alternativo: sin él la imagen no se puede publicar.");
      return;
    }
    const attrs = { src: imagen.url, alt: alt.trim(), caption: pie.trim() || null };
    if (editando) editor.chain().focus().updateAttributes("image", attrs).run();
    else editor.chain().focus().insertContent({ type: "image", attrs }).run();
    onCerrar();
  }

  return (
    <>
      <SelectorImagen
        etiqueta="Imagen"
        imagen={imagen}
        alt={alt}
        onCambiar={(img, nuevoAlt) => {
          setImagen(img);
          setAlt(nuevoAlt);
        }}
        errorAlt={error && imagen ? error : undefined}
        errorImagen={error && !imagen ? error : undefined}
      />
      <TextArea
        label="Pie de foto"
        opcional
        rows={2}
        maxLength={300}
        value={pie}
        onChange={(e) => setPie(e.target.value)}
      />
      <div className="dialogo__acciones">
        <Button variante="secundario" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button onClick={guardar}>{editando ? "Guardar imagen" : "Insertar imagen"}</Button>
      </div>
    </>
  );
}
