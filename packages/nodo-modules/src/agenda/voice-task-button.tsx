"use client";
import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@nodocore/shared-components";
import {
  useExtractTaskFromVoice,
  type ExtractedTask,
  type VoicePromptOption,
} from "./use-extract-task-from-voice";
import type { AiProvider } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

type VoiceState = "idle" | "listening" | "extracting" | "error";

interface VoiceTaskButtonProps {
  apiKey: string | null | undefined;
  provider?: AiProvider;
  onExtracted: (values: ExtractedTask) => void;
  categories?: VoicePromptOption[];
  assigneeOptions?: VoicePromptOption[];
  propertyOptions?: VoicePromptOption[];
  label?: string;
  className?: string;
  idleVariant?: "outline" | "default" | "ghost";
  onSettingsClick?: () => void;
}

// ── Hints panel ───────────────────────────────────────────────────────────────

function VoiceHintsPanel({
  categories,
  assigneeOptions,
}: {
  categories?: VoicePromptOption[];
  assigneeOptions?: VoicePromptOption[];
}) {
  const cat = categories?.map((c) => c.label.toLowerCase()) ?? [];
  const firstAssignee = assigneeOptions?.[0]?.label;

  const examples = [
    cat[0] && `"Para hoy, ${cat[0]} en Lavalle 450, alta prioridad${firstAssignee ? `, asignar a ${firstAssignee}` : ""}"`,
    cat[1] && `"Mañana ${cat[1]} de alquiler, baja prioridad"`,
    cat[2] && `"El viernes ${cat[2]} de contrato, urgente"`,
    !cat[0] && '"Para hoy, visita en Pichincha 220, alta prioridad"',
    !cat[1] && '"Mañana cobro de expensas, baja prioridad"',
  ].filter(Boolean) as string[];

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-md border border-border bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-navy">Podés decir, por ejemplo:</p>
      <ul className="space-y-1.5">
        {examples.slice(0, 3).map((phrase) => (
          <li key={phrase} className="rounded bg-slate-50 px-2 py-1 text-[11px] italic text-slate-600">
            {phrase}
          </li>
        ))}
      </ul>
      <div className="mt-2 space-y-1 border-t border-border pt-2">
        <p className="text-[11px] text-slate2">
          <span className="font-semibold">Prioridad:</span> "urgente" · "alta" · "media" · "baja"
        </p>
        {assigneeOptions && assigneeOptions.length > 0 && (
          <p className="text-[11px] text-slate2">
            <span className="font-semibold">Asignar a:</span>{" "}
            {assigneeOptions
              .slice(0, 3)
              .map((a) => a.label)
              .join(", ")}
            {assigneeOptions.length > 3 && "…"}
          </p>
        )}
        {cat.length > 0 && (
          <p className="text-[11px] text-slate2">
            <span className="font-semibold">Categorías:</span> {cat.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoiceTaskButton({
  apiKey,
  provider = "gemini",
  onExtracted,
  categories,
  assigneeOptions,
  propertyOptions,
  label,
  className,
  idleVariant = "outline",
  onSettingsClick,
}: VoiceTaskButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const { extract, hasApiKey } = useExtractTaskFromVoice(apiKey, provider, {
    categories,
    assignees: assigneeOptions,
    properties: propertyOptions,
  });

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
  const buttonVariant = state === "error" ? "destructive" : idleVariant;

  return (
    <div className="relative">
      <Button
        id="voice-task-btn"
        variant={buttonVariant as "destructive" | "outline" | "default" | "ghost"}
        size="sm"
        onClick={handleClick}
        disabled={isProcessing}
        title={tooltipText[state]}
        aria-label={tooltipText[state]}
        className={`gap-2 transition-all ${
          isListening
            ? "animate-pulse border-red-500 bg-red-500 text-white hover:bg-red-600"
            : ""
        } ${className ?? ""}`}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isListening ? (
          <MicOff className="h-4 w-4 shrink-0" />
        ) : (
          <Mic className="h-4 w-4 shrink-0" />
        )}
        {label && <span>{isListening ? "Escuchando…" : isProcessing ? "Procesando…" : label}</span>}
      </Button>

      {/* Listening hints panel */}
      {isListening && (
        <VoiceHintsPanel categories={categories} assigneeOptions={assigneeOptions} />
      )}

      {/* Inline error tooltip */}
      {state === "error" && errorMessage && (
        onSettingsClick ? (
          <button
            type="button"
            role="alert"
            onClick={onSettingsClick}
            className="absolute left-0 top-full z-50 mt-1.5 w-64 max-w-[calc(100vw-2rem)] cursor-pointer rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-xs text-red-700 shadow-md transition-colors hover:bg-red-100"
          >
            {errorMessage}
            <span className="mt-0.5 block font-semibold underline">
              Ir a Configuración → IA
            </span>
          </button>
        ) : (
          <div
            role="alert"
            className="absolute left-0 top-full z-50 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-md"
          >
            {errorMessage}
          </div>
        )
      )}

      {/* Listening ping indicator */}
      {isListening && (
        <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-red-500 ring-2 ring-white" />
      )}
    </div>
  );
}
