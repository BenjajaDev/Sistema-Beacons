import { TextField } from "@shared/ui/Field";
import type { FotoAdmin } from "../api";
import { Coleccion, type Config } from "../Coleccion";
import { Cabecera, SelectorImagen, usePanelPage, type ImagenElegida } from "../ui";

// Galería de fotos del proyecto. Cada foto lleva su pie, un crédito opcional y,
// siempre, su texto alternativo: la galería es contenido, no decoración.

interface FormFoto {
  name: string;
  credit: string;
  media: ImagenElegida | null;
  alt: string;
}

function CamposFoto({
  form,
  set,
  errores,
}: {
  form: FormFoto;
  set: (f: FormFoto) => void;
  errores: Record<string, string>;
}) {
  return (
    <>
      <TextField
        label="Pie de foto"
        value={form.name}
        maxLength={120}
        ayuda="Lo que se lee bajo la foto. Por ejemplo: «Taller de orientación en la Biblioteca Nacional»."
        onChange={(e) => set({ ...form, name: e.target.value })}
        error={errores.name}
        data-autofocus
      />
      <TextField
        label="Crédito"
        opcional
        value={form.credit}
        maxLength={120}
        placeholder="Foto: Ana Rojas"
        onChange={(e) => set({ ...form, credit: e.target.value })}
        error={errores.credit}
      />
      <SelectorImagen
        etiqueta="Foto"
        imagen={form.media}
        alt={form.alt}
        onCambiar={(media, alt) => set({ ...form, media, alt })}
        errorImagen={errores.mediaId}
        errorAlt={errores.alt}
        ayudaAlt="Describe lo que se ve, como se lo contarías a alguien por teléfono: quiénes, dónde y qué hacen. No repitas el pie de foto."
      />
    </>
  );
}

const fotos: Config<FotoAdmin, FormFoto> = {
  ruta: "/gallery",
  titulo: "Fotos",
  elemento: "Foto",
  avisoAgregado: "Foto agregada.",
  vacio: "Aún no hay fotos en la galería",
  descripcion: (f) => f.credit ?? "",
  miniatura: (f) => f.media.url,
  aFormulario: (f) => ({
    name: f?.name ?? "",
    credit: f?.credit ?? "",
    media: f ? { id: f.media.id, url: f.media.url } : null,
    alt: f?.alt ?? "",
  }),
  aCuerpo: (f) => ({
    name: f.name,
    credit: f.credit || null,
    mediaId: f.media?.id ?? null,
    alt: f.alt,
  }),
  Campos: CamposFoto,
};

export default function Galeria() {
  const h1 = usePanelPage("Galería");
  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Galería"
        descripcion="Fotos del proyecto. Aparecen en la página «Galería» (el enlace se muestra en el menú cuando hay al menos una foto visible), en el orden de esta lista."
      />
      <Coleccion c={fotos} />
    </div>
  );
}
