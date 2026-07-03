import { useCallback, useRef, useState } from "react";
import { Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExtractTransferFromVoice } from "@/features/saldos/hooks/use-extract-transfer-from-voice";
import type { Cuenta } from "@/types";

type VoiceState = "idle" | "listening" | "extracting" | "error";

interface VoiceTransferButtonProps {
  cuentas: Cuenta[];
  onTransferExtracted: (data: {
    cuentaOrigenId: string;
    cuentaDestinoId: string;
    monto: number;
    descripcion?: string;
  }) => void | Promise<void>;
  disabled?: boolean;
  /** When true renders a compact outline button (for use inside modal headers) */
  compact?: boolean;
}

export function VoiceTransferButton({
  cuentas,
  onTransferExtracted,
  disabled,
  compact = false,
}: VoiceTransferButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const { extract, hasApiKey } = useExtractTransferFromVoice();

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
        "Configurá tu API key de Gemini en Configuración → Integraciones IA (abajo en esta página).",
      );
      setState("error");
      setTimeout(() => setState("idle"), 5000);
      return;
    }

    if (!isSupported) {
      setErrorMessage("Tu navegador no soporta voz. Probá Chrome o Edge.");
      setState("error");
      setTimeout(() => setState("idle"), 4000);
      return;
    }

    if (cuentas.filter((c) => c.activa).length < 2) {
      setErrorMessage("Necesitás al menos dos cuentas activas para transferir.");
      setState("error");
      setTimeout(() => setState("idle"), 4000);
      return;
    }

    setErrorMessage(null);

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognitionAPI as new () => any)();
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
        const data = await extract(transcript, cuentas.filter((c) => c.activa));
        await onTransferExtracted(data);
        setState("idle");
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        const msg =
          code === "NO_API_KEY"
            ? "Configurá tu API key de Gemini en Configuración → Integraciones IA."
            : code === "NO_MATCH" || code === "INVALID_PARSE" || code === "INVALID_IDS"
              ? "No pude identificar las cuentas o el monto. Intentá de nuevo más claro."
              : code === "SAME_ACCOUNT"
                ? "Origen y destino son la misma cuenta."
                : code === "CURRENCY_MISMATCH"
                  ? "Las cuentas tienen distinta moneda (ARS vs USD)."
                  : code === "NEED_TWO_ACCOUNTS"
                    ? "Necesitás al menos dos cuentas activas."
                    : "No se pudo interpretar el dictado. Intentá de nuevo.";
        setErrorMessage(msg);
        setState("error");
        setTimeout(() => setState("idle"), 5000);
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
      setState((curr) => (curr === "listening" ? "idle" : curr));
    };

    recognition.start();
  }, [state, hasApiKey, isSupported, cuentas, extract, onTransferExtracted]);

  const isProcessing = state === "extracting";
  const isListening = state === "listening";

  const recordingButtonClass =
    "!bg-red-600 !text-white !border-red-600 hover:!bg-red-700 hover:!text-white focus:!bg-red-600 focus:!text-white [&_svg]:!text-white animate-pulse";

  const tooltip =
    state === "listening"
      ? "Escuchando… clic para detener"
      : state === "extracting"
        ? "Procesando transferencia…"
        : state === "error"
          ? errorMessage ?? "Error"
          : "Dictar transferencia (ej: envié 200 mil de Mercado Pago a Santander)";

  return (
    <div className="relative">
      <Button
        type="button"
        variant={
          isListening ? "danger" :
          state === "error" ? (compact ? "danger" : "primary") :
          compact ? "outline" : "primary"
        }
        size={compact ? "sm" : undefined}
        onClick={handleClick}
        disabled={disabled || isProcessing}
        title={tooltip}
        aria-label={tooltip}
        className={[
          isListening ? recordingButtonClass : '',
          !compact ? 'shrink-0 whitespace-nowrap' : '',
        ].join(' ') || undefined}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{compact ? 'Procesando…' : 'Procesando…'}</span>
          </>
        ) : isListening ? (
          <>
            <MicOff className="h-4 w-4" />
            <span>{compact ? 'Detener' : 'Escuchando…'}</span>
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            <span>{compact ? 'Dictar' : 'Transferir por voz'}</span>
          </>
        )}
      </Button>

      {state === "error" && errorMessage && (
        <div
          role="alert"
          className="absolute top-full right-0 mt-1.5 z-50 w-72 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-sm"
        >
          {errorMessage}
        </div>
      )}

      {isListening && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white animate-ping" />
      )}
    </div>
  );
}
