import { useRef, useState } from "react";
import { mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { SelectField, TextArea, TextField } from "@shared/ui/Field";
import { useToast } from "@shared/ui/Toast";
import { TIPOS_RECURSO, type TipoRecurso } from "../../public/data";
import { adminFetch, type Recurso } from "../api";
import { Coleccion, type Config } from "../Coleccion";
import { Cabecera, usePanelPage } from "../ui";

// Repositorio de recursos abiertos: informes, artículos y guías. Cada uno lleva un PDF
// subido al sitio, un DOI o un enlace a un repositorio institucional (al menos uno).

interface Archivo {
  id: string;
  sizeBytes: number;
  originalName: string;
}

interface FormRecurso {
  title: string;
  kind: TipoRecurso;
  authors: string;
  publishedOn: string;
  description: string;
  license: string;
  file: Archivo | null;
  doi: string;
  externalUrl: string;
}

function tamano(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Subida del PDF. El <input type="file"> va oculto: el control accesible es el botón.
function SelectorPdf({
  archivo,
  onCambiar,
  error,
}: {
  archivo: Archivo | null;
  onCambiar: (a: Archivo | null) => void;
  error?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const toast = useToast();

  async function subir(file: File) {
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append("archivo", file);
      const { media } = await adminFetch<{ media: Archivo }>("/documents", {
        method: "POST",
        body: datos,
      });
      onCambiar(media);
      toast.exito("PDF subido.");
    } catch (err) {
      toast.error(`No se pudo subir el PDF. ${mensajeDeError(err)}`);
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <fieldset className="selector-imagen">
      <legend>Archivo PDF</legend>
      {archivo ? (
        <p>
          <strong>{archivo.originalName}</strong> ({tamano(archivo.sizeBytes)})
        </p>
      ) : (
        <p className="selector-imagen__vacio">Sin archivo.</p>
      )}
      <div className="selector-imagen__acciones">
        <input
          ref={entrada}
          type="file"
          accept="application/pdf"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])}
        />
        <Button
          id="recurso-pdf"
          variante="secundario"
          cargando={subiendo}
          textoCargando="Subiendo…"
          onClick={() => entrada.current?.click()}
        >
          {archivo ? "Reemplazar PDF" : "Subir PDF"}
        </Button>
        {archivo && (
          <Button variante="fantasma" onClick={() => onCambiar(null)}>
            Quitar PDF
          </Button>
        )}
      </div>
      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      <p className="campo__ayuda">
        Sube un PDF accesible: con texto seleccionable (no una foto de las páginas) y con
        encabezados y títulos marcados. Si el documento está en otro lugar, deja este campo vacío y
        completa el DOI o el enlace.
      </p>
    </fieldset>
  );
}

function CamposRecurso({
  form,
  set,
  errores,
}: {
  form: FormRecurso;
  set: (f: FormRecurso) => void;
  errores: Record<string, string>;
}) {
  return (
    <>
      <TextField
        label="Título"
        value={form.title}
        maxLength={200}
        onChange={(e) => set({ ...form, title: e.target.value })}
        error={errores.title}
        data-autofocus
      />
      <SelectField
        label="Tipo"
        value={form.kind}
        onChange={(e) => set({ ...form, kind: e.target.value as TipoRecurso })}
        error={errores.kind}
      >
        {TIPOS_RECURSO.map((t) => (
          <option key={t.clave} value={t.clave}>
            {t.etiqueta}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Autoría"
        opcional
        value={form.authors}
        maxLength={200}
        placeholder="Equipo SIGNAL"
        onChange={(e) => set({ ...form, authors: e.target.value })}
        error={errores.authors}
      />
      <TextField
        label="Fecha de publicación"
        opcional
        type="date"
        value={form.publishedOn}
        ayuda="La del documento, no la de hoy. Ordena la lista: lo más reciente va primero."
        onChange={(e) => set({ ...form, publishedOn: e.target.value })}
        error={errores.publishedOn}
      />
      <TextArea
        label="Descripción"
        opcional
        rows={3}
        maxLength={600}
        ayuda="Dos o tres frases sobre de qué trata."
        value={form.description}
        onChange={(e) => set({ ...form, description: e.target.value })}
        error={errores.description}
      />
      <TextField
        label="Licencia"
        opcional
        value={form.license}
        maxLength={80}
        placeholder="CC BY 4.0"
        onChange={(e) => set({ ...form, license: e.target.value })}
        error={errores.license}
      />
      <SelectorPdf
        archivo={form.file}
        onCambiar={(file) => set({ ...form, file })}
        error={errores.fileId ?? errores.archivo}
      />
      <TextField
        label="DOI"
        opcional
        value={form.doi}
        maxLength={200}
        placeholder="10.1234/abcd.5678"
        ayuda="Sirve también el enlace completo de doi.org."
        onChange={(e) => set({ ...form, doi: e.target.value })}
        error={errores.doi}
      />
      <TextField
        label="Enlace al repositorio"
        opcional
        value={form.externalUrl}
        placeholder="https://"
        ayuda="Si el documento está en el repositorio de una universidad u otra institución."
        onChange={(e) => set({ ...form, externalUrl: e.target.value })}
        error={errores.externalUrl}
      />
    </>
  );
}

const recursos: Config<Recurso, FormRecurso> = {
  ruta: "/resources",
  titulo: "Recursos publicados",
  elemento: "Recurso",
  avisoAgregado: "Recurso agregado.",
  vacio: "Aún no hay recursos",
  ordenable: false,
  descripcion: (r) =>
    [
      TIPOS_RECURSO.find((t) => t.clave === r.kind)?.etiqueta,
      r.publishedOn?.slice(0, 10),
      r.file ? "PDF" : r.doi ? "DOI" : "Enlace",
    ]
      .filter(Boolean)
      .join(" · "),
  miniatura: () => null,
  aFormulario: (r) => ({
    title: r?.title ?? "",
    kind: r?.kind ?? "REPORT",
    authors: r?.authors ?? "",
    publishedOn: r?.publishedOn?.slice(0, 10) ?? "",
    description: r?.description ?? "",
    license: r?.license ?? "",
    file: r?.file ?? null,
    doi: r?.doi ?? "",
    externalUrl: r?.externalUrl ?? "",
  }),
  aCuerpo: (f) => ({
    title: f.title,
    kind: f.kind,
    authors: f.authors || null,
    publishedOn: f.publishedOn || null,
    description: f.description || null,
    license: f.license || null,
    fileId: f.file?.id ?? null,
    doi: f.doi || null,
    externalUrl: f.externalUrl || null,
  }),
  Campos: CamposRecurso,
};

export default function Recursos() {
  const h1 = usePanelPage("Recursos");
  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Recursos"
        descripcion="Informes, artículos y guías abiertos. Aparecen en la página «Recursos» (el enlace se muestra en el menú cuando hay al menos uno visible), del más reciente al más antiguo."
      />
      <Coleccion c={recursos} />
    </div>
  );
}
