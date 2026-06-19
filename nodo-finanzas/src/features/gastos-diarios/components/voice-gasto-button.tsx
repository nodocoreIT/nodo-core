import { useCallback, useRef, useState } from 'react';
import { Loader2, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

interface SpeechRecognitionResultLike {
  0: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  results: Array<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface VoiceGastoButtonProps {
  onTranscript: (text: string) => Promise<void>;
  disabled?: boolean;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function VoiceGastoButton({ onTranscript, disabled = false }: VoiceGastoButtonProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const isSupported = getSpeechRecognition() !== null;

  const handleClick = useCallback(async () => {
    if (state === 'listening') {
      recognitionRef.current?.stop();
      return;
    }

    if (!isSupported) {
      setErrorMessage('Tu navegador no soporta dictado por voz. Probá en Chrome o Edge.');
      setState('error');
      setTimeout(() => setState('idle'), 4000);
      return;
    }

    const SpeechRecognitionAPI = getSpeechRecognition();
    if (!SpeechRecognitionAPI) return;

    setErrorMessage(null);
    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.lang = 'es-AR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState('listening');

    recognition.onresult = async (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (!transcript.trim()) {
        setState('idle');
        return;
      }

      setState('processing');
      try {
        await onTranscript(transcript);
        setState('idle');
      } catch {
        setErrorMessage('No se pudo interpretar el dictado. Intentá de nuevo.');
        setState('error');
        setTimeout(() => setState('idle'), 4000);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') {
        setState('idle');
        return;
      }
      setErrorMessage('Error al escuchar. Verificá que el micrófono esté habilitado.');
      setState('error');
      setTimeout(() => setState('idle'), 4000);
    };

    recognition.onend = () => {
      setState((current) => (current === 'listening' ? 'idle' : current));
    };

    recognition.start();
  }, [isSupported, onTranscript, state]);

  const tooltipText: Record<VoiceState, string> = {
    idle: isSupported ? 'Dictar gasto por voz' : 'Dictado no disponible en este navegador',
    listening: 'Escuchando… hacé clic para detener',
    processing: 'Interpretando dictado…',
    error: errorMessage ?? 'Error',
  };

  const isProcessing = state === 'processing';
  const isListening = state === 'listening';

  return (
    <div className="relative">
      <Button
        type="button"
        variant={state === 'error' ? 'danger' : 'outline'}
        size="sm"
        onClick={handleClick}
        disabled={disabled || isProcessing || !isSupported}
        title={tooltipText[state]}
        aria-label={tooltipText[state]}
        className={isListening ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 animate-pulse' : ''}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Interpretando…
          </>
        ) : isListening ? (
          <>
            <MicOff className="h-4 w-4" />
            Detener
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            Dictar gasto
          </>
        )}
      </Button>

      {state === 'error' && errorMessage && (
        <div
          role="alert"
          className="absolute top-full left-0 mt-1.5 z-50 w-72 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-sm"
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
