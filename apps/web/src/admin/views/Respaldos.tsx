import { TextArea, TextField } from "@shared/ui/Field";
import type { Respaldo } from "../api";
import { Coleccion, type Config } from "../Coleccion";
import { Cabecera, SelectorImagen, usePanelPage, type ImagenElegida } from "../ui";

// Instituciones que respaldan el proyecto (financiamiento, patrocinio). No son
// colaboradores: se muestran en el pie de todas las páginas del sitio.

interface FormRespaldo {
  name: string;
  kind: string;
  description: string;
  url: string;
  logo: ImagenElegida | null;
  logoAlt: string;
}

function CamposRespaldo({
  form,
  set,
  errores,
}: {
  form: FormRespaldo;
  set: (f: FormRespaldo) => void;
  errores: Record<string, string>;
}) {
  return (
    <>
      <TextField
        label="Nombre de la institución"
        value={form.name}
        maxLength={120}
        onChange={(e) => set({ ...form, name: e.target.value })}
        error={errores.name}
        data-autofocus
      />
      <TextField
        label="Tipo de respaldo"
        value={form.kind}
        maxLength={60}
        ayuda="Se lee sobre el logo. Por ejemplo: «Financia», «Patrocina» o «Institución ejecutora»."
        onChange={(e) => set({ ...form, kind: e.target.value })}
        error={errores.kind}
      />
      <TextArea
        label="Mención"
        opcional
        rows={2}
        maxLength={300}
        ayuda="Por ejemplo: «Proyecto financiado por el programa Conocimientos 2030», con el código del proyecto si corresponde."
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
        ayudaAlt="El nombre de la institución, por ejemplo «Universidad Autónoma de Chile». Usa el logo oficial, idealmente sobre fondo blanco o transparente."
      />
    </>
  );
}

const respaldos: Config<Respaldo, FormRespaldo> = {
  ruta: "/backers",
  titulo: "Instituciones",
  elemento: "Respaldo",
  vacio: "Aún no hay instituciones que respalden el proyecto",
  descripcion: (r) => [r.kind, r.description].filter(Boolean).join(" · "),
  miniatura: (r) => r.logo?.url ?? null,
  aFormulario: (r) => ({
    name: r?.name ?? "",
    kind: r?.kind ?? "",
    description: r?.description ?? "",
    url: r?.url ?? "",
    logo: r?.logo ? { id: r.logo.id, url: r.logo.url } : null,
    logoAlt: r?.logoAlt ?? "",
  }),
  aCuerpo: (f) => ({
    name: f.name,
    kind: f.kind,
    description: f.description || null,
    url: f.url || null,
    logoId: f.logo?.id ?? null,
    logoAlt: f.logo ? f.logoAlt : null,
  }),
  Campos: CamposRespaldo,
};

export default function Respaldos() {
  const h1 = usePanelPage("Respaldos");
  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Respaldos"
        descripcion="Instituciones que financian o patrocinan el proyecto. Aparecen en el pie de todas las páginas, bajo «Con el respaldo de», en el orden de esta lista."
      />
      <Coleccion c={respaldos} />
    </div>
  );
}
