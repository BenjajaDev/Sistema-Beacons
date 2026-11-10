// Lectura en voz alta con la voz del dispositivo (Web Speech API), para quien
// no usa lector de pantalla: el texto alternativo de una imagen o la
// audiodescripción de una sección. Suena una sola lectura a la vez; cada botón
// sabe si la suya es la que suena para ofrecer «Detener».

type Aviso = () => void;

// Lo que se configura en el panel («Audiodescriptor»): ver server/src/content/voice.ts.
export interface ConfigVoz {
  idioma: string;
  // Nombre de la voz del sistema; vacío = la mejor disponible para el idioma.
  voz: string;
  velocidad: number;
}

export const CONFIG_INICIAL: ConfigVoz = { idioma: "es-CL", voz: "", velocidad: 1 };

let config: ConfigVoz = CONFIG_INICIAL;
let actual: string | null = null;
const avisos = new Set<Aviso>();

function cambiar(id: string | null) {
  actual = id;
  for (const aviso of avisos) aviso();
}

export function vozDisponible(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

export function configurarVoz(nueva: ConfigVoz) {
  config = nueva;
}

// La voz elegida si este dispositivo la tiene; si no, una del mismo idioma y
// región (es-CL), luego del mismo idioma (es) y, si no hay, la del sistema.
export function elegirVoz(
  voces: Pick<SpeechSynthesisVoice, "name" | "lang">[],
  { idioma, voz }: Pick<ConfigVoz, "idioma" | "voz">,
) {
  const norma = (lang: string) => lang.toLowerCase().replace("_", "-");
  const base = norma(idioma).split("-")[0]!;
  return (
    (voz ? voces.find((v) => v.name === voz) : undefined) ??
    voces.find((v) => norma(v.lang) === norma(idioma)) ??
    voces.find((v) => norma(v.lang).split("-")[0] === base)
  );
}

export function hablar(id: string, texto: string, ajustes: ConfigVoz = config) {
  if (!vozDisponible() || !texto.trim()) return;
  const sintesis = window.speechSynthesis;
  sintesis.cancel();
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = ajustes.idioma;
  frase.rate = ajustes.velocidad;
  const voz = elegirVoz(sintesis.getVoices(), ajustes);
  if (voz) frase.voice = voz as SpeechSynthesisVoice;
  // Solo la lectura vigente limpia el estado: cancel() dispara el fin de la anterior.
  const terminar = () => {
    if (actual === id) cambiar(null);
  };
  frase.onend = terminar;
  frase.onerror = terminar;
  cambiar(id);
  sintesis.speak(frase);
}

export function detener() {
  if (vozDisponible()) window.speechSynthesis.cancel();
  cambiar(null);
}

export function suscribir(aviso: Aviso) {
  avisos.add(aviso);
  return () => {
    avisos.delete(aviso);
  };
}

export const leyendo = () => actual;

// Voces de este dispositivo. El navegador las carga después de la página y
// avisa con «voiceschanged»; la lista se guarda para no crear una nueva en cada render.
let voces: SpeechSynthesisVoice[] = [];
export function suscribirVoces(aviso: Aviso) {
  if (!vozDisponible()) return () => {};
  const actualizar = () => {
    voces = window.speechSynthesis.getVoices();
    aviso();
  };
  actualizar();
  window.speechSynthesis.addEventListener?.("voiceschanged", actualizar);
  return () => window.speechSynthesis.removeEventListener?.("voiceschanged", actualizar);
}
export const vocesDelDispositivo = () => voces;
