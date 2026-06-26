/** Web Speech API helpers — dictado clínico en español (Argentina). */

export function getSpeechRecognitionCtor():
  | (new () => SpeechRecognition)
  | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function speechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

export function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Permiso de micrófono denegado. Habilitalo en el candado de la barra de direcciones.";
    case "no-speech":
      return "No se detectó voz. Acercate al micrófono y volvé a intentar.";
    case "audio-capture":
      return "No se encontró micrófono en este dispositivo.";
    case "network":
      return "El dictado requiere internet (Chrome usa servicios de Google para transcribir).";
    case "aborted":
      return "Dictado detenido.";
    default:
      return `Error de dictado (${code}). Probá otro navegador (Chrome/Edge) o escribí manualmente.`;
  }
}

export const SPEECH_LANG = "es-AR";
