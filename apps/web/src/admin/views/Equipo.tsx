import { Button } from "@shared/ui/Button";
import { SelectField, TextArea, TextField } from "@shared/ui/Field";
import {
  GRUPOS_EQUIPO,
  TIPOS_COLABORADOR,
  type CategoriaEquipo,
  type Encuadre,
  type Persona as PersonaPublica,
  type TipoColaborador,
} from "../../public/data";
import type { Colaborador, Enlace, Persona } from "../api";
import { Coleccion, type Config } from "../Coleccion";
import { Cabecera, SelectorImagen, usePanelPage, type ImagenElegida } from "../ui";
import { VistaPreviaPersona } from "../VistaPreviaPersona";

// --- Equipo ---

interface FormPersona {
  name: string;
  position: string;
  bio: string;
  area: string;
  education: string;
  affiliation: string;
  category: CategoriaEquipo;
  email: string;
  photo: ImagenElegida | null;
  photoAlt: string;
  photoFrame: Encuadre | null;
  links: Enlace[];
}

// Lista desplegable con un valor de un conjunto cerrado. Un <select> nativo: se maneja
// con el teclado y lo anuncia bien el lector de pantalla.
function Selector<T extends string>({
  etiqueta,
  ayuda,
  valor,
  opciones,
  onCambiar,
}: {
  etiqueta: string;
  ayuda?: string;
  valor: T;
  opciones: readonly { clave: T; titulo: string }[];
  onCambiar: (v: T) => void;
}) {
  return (
    <SelectField
      label={etiqueta}
      ayuda={ayuda}
      value={valor}
      onChange={(e) => onCambiar(e.target.value as T)}
    >
      {opciones.map((o) => (
        <option key={o.clave} value={o.clave}>
          {o.titulo}
        </option>
      ))}
    </SelectField>
  );
}

// La persona como la recibe la landing, para la vista previa.
const comoEnLaLanding = (f: FormPersona): PersonaPublica => ({
  name: f.name,
  position: f.position,
  bio: f.bio || null,
  area: f.area || null,
  education: f.education || null,
  affiliation: f.affiliation || null,
  category: f.category,
  email: f.email || null,
  links: f.links.filter((l) => l.url),
  photo: f.photo ? { url: f.photo.url, alt: f.photoAlt, width: null, height: null } : null,
  photoFrame: f.photoFrame,
});

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
      <Selector
        etiqueta="Grupo"
        ayuda="Dónde aparece en «Nosotros». Solo el equipo se muestra también en el inicio."
        valor={form.category}
        opciones={GRUPOS_EQUIPO}
        onCambiar={(category) => set({ ...form, category })}
      />
      <TextField
        label="Institución"
        opcional
        value={form.affiliation}
        maxLength={120}
        placeholder="Universidad de Chile"
        ayuda="A qué institución pertenece. Se muestra bajo su cargo."
        onChange={(e) => set({ ...form, affiliation: e.target.value })}
        error={errores.affiliation}
      />
      <TextField
        label="Área"
        opcional
        value={form.area}
        maxLength={80}
        placeholder="Ingeniería"
        ayuda="Se muestra en su card junto a la formación."
        onChange={(e) => set({ ...form, area: e.target.value })}
        error={errores.area}
      />
      <TextField
        label="Formación"
        opcional
        value={form.education}
        maxLength={120}
        placeholder="Ingeniería Civil, Universidad de Chile"
        onChange={(e) => set({ ...form, education: e.target.value })}
        error={errores.education}
      />
      <TextField
        label="Correo de contacto"
        opcional
        type="email"
        autoComplete="off"
        value={form.email}
        maxLength={200}
        ayuda="Es público: aparece en la card de la persona. Usa un correo institucional, no uno personal."
        onChange={(e) => set({ ...form, email: e.target.value })}
        error={errores.email}
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
        onCambiar={(photo, photoAlt) =>
          // Una foto distinta empieza centrada: el encuadre anterior era de otra imagen.
          set({
            ...form,
            photo,
            photoAlt,
            photoFrame: photo?.id === form.photo?.id ? form.photoFrame : null,
          })
        }
        errorAlt={errores.photoAlt}
        ayudaAlt="Describe a la persona en la foto, por ejemplo «Ana sonriendo frente a un pizarrón». No repitas solo su nombre."
      />
      <VistaPreviaPersona
        persona={comoEnLaLanding(form)}
        onEncuadre={(photoFrame) => set({ ...form, photoFrame })}
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
            placeholder="LinkedIn, ORCID, ResearchGate…"
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
  avisoAgregado: "Persona agregada.",
  vacio: "Aún no hay personas en el equipo",
  descripcion: (p) => p.position,
  miniatura: (p) => p.photo?.url ?? null,
  aFormulario: (p) => ({
    name: p?.name ?? "",
    position: p?.position ?? "",
    bio: p?.bio ?? "",
    area: p?.area ?? "",
    education: p?.education ?? "",
    affiliation: p?.affiliation ?? "",
    category: p?.category ?? "CORE",
    email: p?.email ?? "",
    photo: p?.photo ? { id: p.photo.id, url: p.photo.url } : null,
    photoAlt: p?.photoAlt ?? "",
    photoFrame: p?.photoFrame ?? null,
    links: p?.links ?? [],
  }),
  aCuerpo: (f) => ({
    name: f.name,
    position: f.position,
    bio: f.bio || null,
    area: f.area || null,
    education: f.education || null,
    affiliation: f.affiliation || null,
    category: f.category,
    email: f.email || null,
    photoId: f.photo?.id ?? null,
    photoAlt: f.photo ? f.photoAlt : null,
    photoFrame: f.photo ? f.photoFrame : null,
    links: f.links,
  }),
  Campos: CamposPersona,
};

// --- Colaboradores ---

interface FormColaborador {
  name: string;
  description: string;
  url: string;
  type: TipoColaborador;
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
      <Selector
        etiqueta="Tipo de organización"
        ayuda="Agrupa a los colaboradores en «Nosotros». Con un solo tipo no se muestran los títulos."
        valor={form.type}
        opciones={TIPOS_COLABORADOR}
        onCambiar={(type) => set({ ...form, type })}
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
  avisoAgregado: "Colaborador agregado.",
  vacio: "Aún no hay colaboradores",
  descripcion: (c) => c.description ?? c.url ?? "",
  miniatura: (c) => c.logo?.url ?? null,
  aFormulario: (c) => ({
    name: c?.name ?? "",
    description: c?.description ?? "",
    url: c?.url ?? "",
    type: c?.type ?? "OTHER",
    logo: c?.logo ? { id: c.logo.id, url: c.logo.url } : null,
    logoAlt: c?.logoAlt ?? "",
  }),
  aCuerpo: (f) => ({
    name: f.name,
    description: f.description || null,
    url: f.url || null,
    type: f.type,
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
