import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import {
  useExtractTaskFromVoice,
  type ExtractedTask,
} from "./use-extract-task-from-voice";
import type { AiProvider } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

type VoiceState = "idle" | "listening" | "extracting" | "error";

interface VoiceTaskButtonProps {
  apiKey: string | null | undefined;
  provider?: AiProvider;
  onExtracted: (values: ExtractedTask) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoiceTaskButton({ apiKey, provider = "gemini", onExtracted }: VoiceTaskButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const { extract, hasApiKey } = useExtractTaskFromVoice(apiKey, provider);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const handleClick = useCallback(async () => {
    if (state === "listening") {
      recognitionRef.current?.stop();
      return;
    }

    if (!hasApiKey) {
      setErrorMessage(
        "Configurá tu API key de Gemini en Configuración → Integraciones / IA",
      );
      setState("error");
      setTimeout(() => setState("idle"), 4000);
      return;
    }

    if (!isSupported) {
      setErrorMessage(
        "Tu navegador no soporta reconocimiento de voz. Probá en Chrome o Edge.",
      );
      setState("error");
      setTimeout(() => setState("idle"), 4000);
      return;
    }

    setErrorMessage(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new SpeechRecognitionAPI() as any;
    recognitionRef.current = recognition;

    recognition.lang = "es-AR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState("listening");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (!transcript.trim()) {
        setState("idle");
        return;
      }

      setState("extracting");
      try {
        const values = await extract(transcript);
        onExtracted(values);
        setState("idle");
      } catch (err) {
        const msg =
          err instanceof Error && err.message === "NO_API_KEY"
            ? "Configurá tu API key de Gemini en Configuración → Integraciones / IA"
            : "No se pudo interpretar el dictado. Intentá de nuevo.";
        setErrorMessage(msg);
        setState("error");
        setTimeout(() => setState("idle"), 4000);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "aborted") {
        setState("idle");
        return;
      }
      setErrorMessage("Error al escuchar. Verificá que el micrófono esté habilitado.");
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    };

    recognition.onend = () => {
      setState((curr) => {
        if (curr === "listening") return "idle";
        return curr;
      });
    };

    recognition.start();
  }, [state, hasApiKey, isSupported, extract, onExtracted]);

  // ── Render helpers ────────────────────────────────────────────────────────────

  const tooltipText: Record<VoiceState, string> = {
    idle: hasApiKey
      ? "Dictar tarea por voz"
      : "Configurá tu API key de Gemini en Configuración → Integraciones / IA",
    listening: "Escuchando… hacé clic para detener",
    extracting: "Procesando con IA…",
    error: errorMessage ?? "Error",
  };

  const isProcessing = state === "extracting";
  const isListening = state === "listening";
  const buttonVariant = state === "error" ? "destructive" : "outline";

  return (
    <div className="relative">
      <Button
        id="voice-task-btn"
        variant={buttonVariant as "destructive" | "outline"}
        size="sm"
        onClick={handleClick}
        disabled={isProcessing || (!hasApiKey && state === "idle")}
        title={tooltipText[state]}
        aria-label={tooltipText[state]}
        className={`transition-all ${
          isListening
            ? "animate-pulse border-red-500 bg-red-500 text-white hover:bg-red-600"
            : ""
        }`}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {/* Inline error tooltip */}
      {state === "error" && errorMessage && (
        <div
          role="alert"
          className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive shadow-sm"
        >
          {errorMessage}
        </div>
      )}

      {/* Listening ping indicator */}
      {isListening && (
        <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-red-500 ring-2 ring-white" />
      )}
    </div>
  );
}
