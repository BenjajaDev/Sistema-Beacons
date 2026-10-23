// Lectura en voz alta con la voz del dispositivo (Web Speech API), para quien
// no usa lector de pantalla: el texto alternativo de una imagen o la
// audiodescripción de una sección. Suena una sola lectura a la vez; cada botón
// sabe si la suya es la que suena para ofrecer «Detener».

type Aviso = () => void;

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

// Prefiere una voz en español de Chile, luego cualquier español.
function vozEnEspanol(): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis.getVoices();
  return (
    voces.find((v) => v.lang.toLowerCase() === "es-cl") ??
    voces.find((v) => v.lang.toLowerCase().startsWith("es"))
  );
}

export function hablar(id: string, texto: string) {
  if (!vozDisponible() || !texto.trim()) return;
  const sintesis = window.speechSynthesis;
  sintesis.cancel();
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = "es-CL";
  const voz = vozEnEspanol();
  if (voz) frase.voice = voz;
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
