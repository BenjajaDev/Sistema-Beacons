import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type CSSProperties } from "react";
import {
  checkPaletteContrast,
  CONTRAST_RULES,
  contrastRatio,
  DEFAULT_FONTS,
  DEFAULT_PALETTE,
  FONT_OPTIONS,
  type FontId,
  type Palette,
  type PaletteMode,
} from "@server-theme";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { ErrorSummary } from "@shared/ui/ErrorSummary";
import { SelectField, TextField } from "@shared/ui/Field";
import { Cargando, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { adminFetch, type Ajustes } from "../api";
import {
  AvisoCambiosSinGuardar,
  Cabecera,
  SelectorImagen,
  usePanelPage,
  type ImagenElegida,
} from "../ui";

type Token = keyof PaletteMode;

const NOMBRES: Record<Token, string> = {
  fondo: "Fondo",
  superficie: "Fondo de tarjetas",
  texto: "Texto",
  textoSuave: "Texto secundario",
  primario: "Color principal (botones)",
  textoSobrePrimario: "Texto sobre el color principal",
  enlace: "Enlaces",
  borde: "Bordes decorativos",
  bordeControl: "Borde de los campos",
  foco: "Indicador de foco",
  acento: "Acento decorativo",
};

const MODOS = [
  { modo: "light", texto: "Tema claro" },
  { modo: "dark", texto: "Tema oscuro" },
] as const;

interface Formulario {
  siteName: string;
  tagline: string;
  palette: Palette;
  fonts: { cuerpo: FontId; titulos: FontId };
  logoLight: ImagenElegida | null;
  logoLightAlt: string;
  logoDark: ImagenElegida | null;
  logoDarkAlt: string;
  favicon: ImagenElegida | null;
}

function desdeAjustes(a: Ajustes): Formulario {
  const img = (i: Ajustes["logoLight"]) => (i ? { id: i.id, url: i.url } : null);
  return {
    siteName: a.siteName,
    tagline: a.tagline ?? "",
    palette: a.palette,
    fonts: a.fonts,
    logoLight: img(a.logoLight),
    logoLightAlt: a.logoLightAlt ?? "",
    logoDark: img(a.logoDark),
    logoDarkAlt: a.logoDarkAlt ?? "",
    favicon: img(a.favicon),
  };
}

const VARIABLES: Record<Token, string> = {
  fondo: "--color-bg",
  superficie: "--color-surface",
  texto: "--color-text",
  textoSuave: "--color-text-muted",
  primario: "--color-primary",
  textoSobrePrimario: "--color-on-primary",
  enlace: "--color-link",
  borde: "--color-border",
  bordeControl: "--color-border-control",
  foco: "--color-focus",
  acento: "--color-accent",
};

function VistaPrevia({
  modo,
  colores,
  titulo,
}: {
  modo: string;
  colores: PaletteMode;
  titulo: string;
}) {
  const estilo = Object.fromEntries(
    (Object.keys(VARIABLES) as Token[]).map((t) => [VARIABLES[t], colores[t]]),
  ) as CSSProperties;
  return (
    <div
      className="muestra-tema"
      style={{ ...estilo, colorScheme: modo === "dark" ? "dark" : "light" }}
    >
      <p className="muestra-tema__titulo">{titulo}</p>
      <p>
        Texto de ejemplo con un{" "}
        <a href="#muestra" onClick={(e) => e.preventDefault()}>
          enlace
        </a>
        .
      </p>
      <p className="muestra-tema__suave">Texto secundario de ejemplo.</p>
      <div className="muestra-tema__tarjeta">
        <span className="btn btn--primario" aria-hidden="true">
          Botón principal
        </span>
        <span className="muestra-tema__campo" aria-hidden="true">
          Campo de formulario
        </span>
      </div>
    </div>
  );
}

export default function Identidad() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin", "ajustes"],
    queryFn: () => adminFetch<{ settings: Ajustes }>("/settings"),
  });
  if (isPending) {
    return (
      <div className="vista-contenido">
        <Cargando etiqueta="Cargando identidad visual…">
          <Skeleton alto="24rem" />
        </Cargando>
      </div>
    );
  }
  if (error) {
    return (
      <div className="vista-contenido">
        <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      </div>
    );
  }
  return <Formulario ajustes={data.settings} />;
}

function Formulario({ ajustes }: { ajustes: Ajustes }) {
  const h1 = usePanelPage("Identidad visual");
  const toast = useToast();
  const queryClient = useQueryClient();
  const inicial = useMemo(() => desdeAjustes(ajustes), [ajustes]);
  const [form, setForm] = useState(inicial);
  const [base, setBase] = useState(JSON.stringify(inicial));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const sucio = JSON.stringify(form) !== base;

  const fallas = checkPaletteContrast(form.palette);
  const color = (modo: "light" | "dark", t: Token, valor: string) =>
    setForm((f) => ({
      ...f,
      palette: { ...f.palette, [modo]: { ...f.palette[modo], [t]: valor } },
    }));

  async function guardar() {
    const locales: Record<string, string> = {};
    if (!form.siteName.trim()) locales["identidad-nombre"] = "Escribe el nombre del sitio.";
    if (form.logoLight && !form.logoLightAlt.trim())
      locales["identidad-logo-claro"] = "Describe el logo para tema claro.";
    if (form.logoDark && !form.logoDarkAlt.trim())
      locales["identidad-logo-oscuro"] = "Describe el logo para tema oscuro.";
    for (const { modo, texto } of MODOS) {
      for (const t of Object.keys(NOMBRES) as Token[]) {
        if (!/^#[0-9A-F]{6}$/i.test(form.palette[modo][t])) {
          locales[`color-${modo}-${t}`] =
            `${texto}: «${NOMBRES[t]}» debe ser un color de 6 dígitos, por ejemplo #004AAD.`;
        }
      }
    }
    for (const f of fallas)
      locales[`color-${f.modo}-${f.frente}`] =
        `${f.modo === "light" ? "Tema claro" : "Tema oscuro"}: ${f.uso} tiene contraste ${f.ratio.toFixed(2)}:1 y necesita ${f.minimo}:1.`;
    setErrores(locales);
    if (Object.keys(locales).length) return;

    setGuardando(true);
    try {
      const { settings } = await adminFetch<{ settings: Ajustes }>("/settings/identity", {
        method: "PUT",
        body: {
          siteName: form.siteName,
          tagline: form.tagline || null,
          palette: form.palette,
          fonts: form.fonts,
          logoLightId: form.logoLight?.id ?? null,
          logoLightAlt: form.logoLight ? form.logoLightAlt : null,
          logoDarkId: form.logoDark?.id ?? null,
          logoDarkAlt: form.logoDark ? form.logoDarkAlt : null,
          faviconId: form.favicon?.id ?? null,
        },
      });
      const nuevo = desdeAjustes(settings);
      setForm(nuevo);
      setBase(JSON.stringify(nuevo));
      queryClient.setQueryData(["admin", "ajustes"], { settings });
      toast.exito("Identidad visual guardada. Recarga el sitio para ver los cambios.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "CONTRAST") {
        toast.error(err.message);
      } else if (err instanceof ApiError && Object.keys(err.campos).length) {
        setErrores(err.campos);
      } else {
        toast.error(`No se pudo guardar. ${mensajeDeError(err)}`);
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="vista-contenido">
      <AvisoCambiosSinGuardar sucio={sucio} />
      <Cabecera
        refH1={h1}
        titulo="Identidad visual"
        descripcion="Nombre, logos, tipografías y colores del sitio y del panel."
      />
      <ErrorSummary
        errores={Object.entries(errores).map(([campoId, mensaje]) => ({ campoId, mensaje }))}
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <section className="tarjeta-panel" aria-labelledby="identidad-marca">
          <h2 id="identidad-marca">Marca</h2>
          <TextField
            id="identidad-nombre"
            label="Nombre del sitio"
            maxLength={60}
            value={form.siteName}
            onChange={(e) => setForm({ ...form, siteName: e.target.value })}
            error={errores["identidad-nombre"]}
          />
          <TextField
            label="Lema"
            opcional
            maxLength={120}
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            ayuda="Aparece junto al nombre en el título de la página de inicio."
          />
          <div className="rejilla-panel">
            <SelectorImagen
              etiqueta="Logo para tema claro (opcional)"
              imagen={form.logoLight}
              alt={form.logoLightAlt}
              onCambiar={(logoLight, logoLightAlt) => setForm({ ...form, logoLight, logoLightAlt })}
              errorAlt={errores["identidad-logo-claro"]}
              ayudaAlt="Normalmente basta con el nombre: «SIGNAL»."
            />
            <SelectorImagen
              etiqueta="Logo para tema oscuro (opcional)"
              imagen={form.logoDark}
              alt={form.logoDarkAlt}
              onCambiar={(logoDark, logoDarkAlt) => setForm({ ...form, logoDark, logoDarkAlt })}
              errorAlt={errores["identidad-logo-oscuro"]}
              ayudaAlt="Normalmente basta con el nombre: «SIGNAL»."
            />
            <SelectorImagen
              etiqueta="Ícono de la pestaña (favicon, opcional)"
              imagen={form.favicon}
              alt=""
              sinAlt
              onCambiar={(favicon) => setForm({ ...form, favicon })}
            />
          </div>
        </section>

        <section className="tarjeta-panel" aria-labelledby="identidad-tipografia">
          <h2 id="identidad-tipografia">Tipografías</h2>
          <div className="rejilla-panel">
            {(["cuerpo", "titulos"] as const).map((uso) => (
              <SelectField
                key={uso}
                label={uso === "cuerpo" ? "Texto" : "Títulos"}
                value={form.fonts[uso]}
                onChange={(e) =>
                  setForm({ ...form, fonts: { ...form.fonts, [uso]: e.target.value as FontId } })
                }
              >
                {(Object.keys(FONT_OPTIONS) as FontId[]).map((id) => (
                  <option key={id} value={id}>
                    {FONT_OPTIONS[id].nombre}
                  </option>
                ))}
              </SelectField>
            ))}
          </div>
          <p className="campo__ayuda">
            Atkinson Hyperlegible Next está diseñada para personas con baja visión: recomendada para
            el texto.
          </p>
        </section>

        {MODOS.map(({ modo, texto }) => (
          <section key={modo} className="tarjeta-panel" aria-labelledby={`colores-${modo}`}>
            <h2 id={`colores-${modo}`}>Colores · {texto}</h2>
            <div className="editor-colores">
              <div className="rejilla-colores">
                {(Object.keys(NOMBRES) as Token[]).map((t) => (
                  <fieldset key={t} className="color" id={`color-${modo}-${t}`} tabIndex={-1}>
                    <legend>{NOMBRES[t]}</legend>
                    <input
                      type="color"
                      aria-label={`${NOMBRES[t]}, ${texto.toLowerCase()}: selector`}
                      value={form.palette[modo][t].toLowerCase()}
                      onChange={(e) => color(modo, t, e.target.value.toUpperCase())}
                    />
                    <input
                      type="text"
                      className="campo__control color__hex"
                      aria-label={`${NOMBRES[t]}, ${texto.toLowerCase()}: código hexadecimal`}
                      value={form.palette[modo][t]}
                      maxLength={7}
                      spellCheck={false}
                      onChange={(e) =>
                        /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) &&
                        color(modo, t, e.target.value.toUpperCase())
                      }
                    />
                  </fieldset>
                ))}
              </div>
              <VistaPrevia
                modo={modo}
                colores={form.palette[modo]}
                titulo={`Vista previa · ${texto}`}
              />
            </div>
            <h3>Contraste (WCAG 2.1 AA)</h3>
            <ul className="lista-contraste">
              {CONTRAST_RULES.map((r) => {
                const valido = /^#[0-9A-F]{6}$/i;
                const a = form.palette[modo][r.frente];
                const b = form.palette[modo][r.fondo];
                const ratio = valido.test(a) && valido.test(b) ? contrastRatio(a, b) : 0;
                const ok = ratio >= r.minimo;
                return (
                  <li key={r.uso} className={ok ? "texto-ok" : "texto-error"}>
                    <span aria-hidden="true">{ok ? "✓" : "✗"}</span> {r.uso}: {ratio.toFixed(2)}:1{" "}
                    <span className="visually-hidden">{ok ? "cumple" : "no cumple"}</span>(mínimo{" "}
                    {r.minimo}:1)
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div className="fila-botones barra-guardar">
          <Button type="submit" cargando={guardando} textoCargando="Guardando…">
            {sucio ? "Guardar identidad visual" : "Sin cambios por guardar"}
          </Button>
          <Button
            variante="fantasma"
            onClick={() => setForm({ ...form, palette: DEFAULT_PALETTE, fonts: DEFAULT_FONTS })}
          >
            Volver a los colores y tipografías por defecto
          </Button>
          {fallas.length > 0 && (
            <p className="texto-error" role="status">
              {fallas.length}{" "}
              {fallas.length === 1 ? "combinación no cumple" : "combinaciones no cumplen"} el
              contraste mínimo.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
