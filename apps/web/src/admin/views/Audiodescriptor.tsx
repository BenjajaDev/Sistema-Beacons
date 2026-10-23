import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_VOICE,
  IDIOMAS_VOZ,
  VELOCIDAD_MAX,
  VELOCIDAD_MIN,
  voiceSchema,
  type Voice,
} from "@server-voice";
import { ApiError, mensajeDeError } from "@shared/api";
import { Button } from "@shared/ui/Button";
import { ErrorSummary } from "@shared/ui/ErrorSummary";
import { SelectField, TextArea } from "@shared/ui/Field";
import { Cargando, ErrorState, Skeleton } from "@shared/ui/States";
import { useToast } from "@shared/ui/Toast";
import { BotonVoz } from "@shared/voz/BotonVoz";
import { suscribirVoces, vocesDelDispositivo, vozDisponible } from "@shared/voz/voz";
import { adminFetch, type Ajustes } from "../api";
import { AvisoCambiosSinGuardar, Cabecera, usePanelPage } from "../ui";

// Configura la voz con que el sitio lee las audiodescripciones y los textos
// alternativos: idioma, voz y velocidad. Las voces son las del dispositivo de
// cada visitante; la elegida aquí se usa donde exista y, si no, la mejor del idioma.

const EJEMPLO =
  "Estás en la portada de SIGNAL. Junto al título hay una ilustración de la señal de un beacon.";

const id = (c: string) => `voz-${c}`;

function desde(a: Ajustes): Voice {
  const r = voiceSchema.safeParse(a.voice);
  return r.success ? r.data : DEFAULT_VOICE;
}

const formatoVelocidad = (v: number) =>
  `${v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}×`;

function Formulario({ ajustes }: { ajustes: Ajustes }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const idVelocidad = useId();
  const inicial = useMemo(() => desde(ajustes), [ajustes]);
  const [form, setForm] = useState(inicial);
  const [base, setBase] = useState(JSON.stringify(inicial));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [prueba, setPrueba] = useState(EJEMPLO);
  const sucio = JSON.stringify(form) !== base;

  // Voces de este navegador: primero las del idioma elegido, luego las de su
  // misma lengua (es-ES para es-CL). La elegida se mantiene aunque aquí no exista.
  const voces = useSyncExternalStore(suscribirVoces, vocesDelDispositivo, vocesDelDispositivo);
  const lengua = form.idioma.split("-")[0]!.toLowerCase();
  const delIdioma = voces
    .filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(lengua))
    .sort((a, b) => Number(b.lang === form.idioma) - Number(a.lang === form.idioma));
  const elegidaAusente = form.voz !== "" && !delIdioma.some((v) => v.name === form.voz);

  async function guardar() {
    const r = voiceSchema.safeParse(form);
    if (!r.success) {
      setErrores(Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    setGuardando(true);
    try {
      const { settings } = await adminFetch<{ settings: Ajustes }>("/settings/voice", {
        method: "PUT",
        body: r.data,
      });
      const nuevo = desde(settings);
      setForm(nuevo);
      setBase(JSON.stringify(nuevo));
      setErrores({});
      queryClient.setQueryData(["admin", "ajustes"], { settings });
      toast.exito("Audiodescriptor guardado. Ya se usa en el sitio.");
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.campos).length) setErrores(err.campos);
      else toast.error(`No se pudo guardar. ${mensajeDeError(err)}`);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="tarjeta-panel" aria-labelledby="voz-titulo">
      <AvisoCambiosSinGuardar sucio={sucio} />
      <h2 id="voz-titulo">Voz del sitio</h2>
      <ErrorSummary
        errores={Object.entries(errores).map(([c, m]) => ({ campoId: id(c), mensaje: m }))}
      />
      {!vozDisponible() && (
        <p className="campo__ayuda" role="note">
          Este navegador no tiene voz: puedes guardar la configuración, pero no probarla aquí.
        </p>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="rejilla-panel">
          <SelectField
            id={id("idioma")}
            label="Idioma"
            ayuda="Debe coincidir con el idioma de los textos: una voz en inglés lee el español con acento."
            value={form.idioma}
            error={errores.idioma}
            onChange={(e) =>
              setForm({ ...form, idioma: e.target.value as Voice["idioma"], voz: "" })
            }
          >
            {IDIOMAS_VOZ.map((i) => (
              <option key={i.valor} value={i.valor}>
                {i.texto}
              </option>
            ))}
          </SelectField>
          <SelectField
            id={id("voz")}
            label="Voz"
            ayuda="Las voces dependen de cada dispositivo. Si un visitante no tiene la elegida, se usa la mejor disponible para el idioma."
            value={form.voz}
            error={errores.voz}
            onChange={(e) => setForm({ ...form, voz: e.target.value })}
          >
            <option value="">Automática (la mejor del dispositivo)</option>
            {elegidaAusente && (
              <option value={form.voz}>{form.voz} (no está en este equipo)</option>
            )}
            {delIdioma.map((v) => (
              <option key={v.voiceURI || v.name} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </SelectField>
        </div>

        <div className="campo recorte__control">
          <label htmlFor={idVelocidad} className="campo__label">
            Velocidad: {formatoVelocidad(form.velocidad)}
          </label>
          <p className="campo__ayuda" id={`${idVelocidad}-ayuda`}>
            1× es la velocidad normal. Para quien escucha por primera vez, conviene entre 0,9× y
            1,1×.
          </p>
          <input
            id={idVelocidad}
            type="range"
            min={VELOCIDAD_MIN}
            max={VELOCIDAD_MAX}
            step={0.1}
            value={form.velocidad}
            aria-describedby={`${idVelocidad}-ayuda`}
            aria-valuetext={formatoVelocidad(form.velocidad)}
            onChange={(e) => setForm({ ...form, velocidad: Number(e.target.value) })}
          />
        </div>

        <fieldset className="grupo-campos">
          <legend>Probar la voz</legend>
          <TextArea
            id={id("prueba")}
            label="Texto de prueba"
            ayuda="No se guarda: sirve para escuchar cómo suena con los ajustes de arriba."
            rows={2}
            maxLength={400}
            value={prueba}
            onChange={(e) => setPrueba(e.target.value)}
          />
          <BotonVoz texto={prueba} etiqueta="Escuchar la prueba" variante="texto" ajustes={form} />
        </fieldset>

        <div className="fila-botones">
          <Button type="submit" cargando={guardando} textoCargando="Guardando…">
            {sucio ? "Guardar audiodescriptor" : "Sin cambios por guardar"}
          </Button>
          <Button variante="fantasma" onClick={() => setForm(DEFAULT_VOICE)}>
            Volver a los valores por defecto
          </Button>
        </div>
      </form>
    </section>
  );
}

export default function Audiodescriptor() {
  const h1 = usePanelPage("Audiodescriptor");
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin", "ajustes"],
    queryFn: () => adminFetch<{ settings: Ajustes }>("/settings"),
  });
  return (
    <div className="vista-contenido">
      <Cabecera
        refH1={h1}
        titulo="Audiodescriptor"
        descripcion="La voz con que el sitio lee las audiodescripciones de las secciones y los textos alternativos de las imágenes."
      />
      {isPending ? (
        <Cargando>
          <Skeleton alto="16rem" />
        </Cargando>
      ) : error ? (
        <ErrorState mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : (
        <Formulario ajustes={data.settings} />
      )}
    </div>
  );
}
