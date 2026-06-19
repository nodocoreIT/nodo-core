import { useCallback, useRef, useState } from 'react';
import { Loader2, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

type VoiceState = 'idle' | 'listening' | 'processing' | 'error' | 'success';

interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
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

function collectAllTranscript(event: SpeechRecognitionEventLike): string {
  let text = '';
  for (let i = 0; i < event.results.length; i++) {
    text += event.results[i]?.[0]?.transcript ?? '';
  }
  return text.trim();
}

function collectFinalTranscript(event: SpeechRecognitionEventLike): string {
  let text = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    if (result?.isFinal) {
      text += result[0]?.transcript ?? '';
    }
  }
  return text.trim();
}

const STATUS_LABEL: Record<VoiceState, string> = {
  idle: 'Listo para dictar',
  listening: 'Escuchando… hablá ahora',
  processing: 'Interpretando lo que escuchó…',
  error: 'Falló la interpretación',
  success: 'Dictado aplicado',
};

export function VoiceGastoButton({ onTranscript, disabled = false }: VoiceGastoButtonProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastSentTranscript, setLastSentTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef('');
  const liveTranscriptRef = useRef('');
  const skipEndProcessingRef = useRef(false);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const resolveErrorMessage = (err: unknown, transcript: string): string => {
    const code = err instanceof Error ? err.message : '';
    const heard = transcript ? ` Escuché: «${transcript}»` : ' No se capturó texto del micrófono.';
    if (code === 'NO_API_KEY') {
      return `Configurá tu API key de Gemini en Configuración → Integraciones IA.${heard}`;
    }
    if (code === 'NO_MONTO') {
      return `No detectamos el monto. Decilo con números (ej: 250 pesos).${heard}`;
    }
    if (code === 'EMPTY_PARSE') {
      return `No pudimos interpretar el dictado.${heard}`;
    }
    if (code.startsWith('GEMINI_ERROR')) {
      return `Error al consultar Gemini. Revisá la API key en Configuración.${heard}`;
    }
    if (code && code !== 'Error') {
      return `No se pudo interpretar el dictado (${code}).${heard}`;
    }
    return `No se pudo interpretar el dictado.${heard}`;
  };

  const processTranscript = useCallback(
    async (transcript: string) => {
      setLastSentTranscript(transcript);
      setLiveTranscript(transcript);

      if (!transcript) {
        setErrorMessage('No se detectó audio. Verificá permisos del micrófono y hablá más cerca.');
        setState('error');
        setTimeout(() => setState('idle'), 6000);
        return;
      }

      setState('processing');
      try {
        await onTranscript(transcript);
        setState('success');
        setErrorMessage(null);
        setTimeout(() => setState('idle'), 3000);
      } catch (err) {
        setErrorMessage(resolveErrorMessage(err, transcript));
        setState('error');
        setTimeout(() => setState('idle'), 8000);
      }
    },
    [onTranscript],
  );

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
    setLiveTranscript('');
    setLastSentTranscript('');
    transcriptRef.current = '';
    skipEndProcessingRef.current = false;

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.lang = 'es-AR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState('listening');
      setLiveTranscript('');
      liveTranscriptRef.current = '';
    };

    recognition.onresult = (event) => {
      const allHeard = collectAllTranscript(event);
      liveTranscriptRef.current = allHeard;
      setLiveTranscript(allHeard);

      const chunk = collectFinalTranscript(event);
      if (chunk) transcriptRef.current = `${transcriptRef.current} ${chunk}`.trim();

      if (!chunk && event.results.length > 0) {
        const last = event.results[event.results.length - 1];
        if (!last.isFinal) {
          transcriptRef.current = last[0]?.transcript?.trim() ?? transcriptRef.current;
        }
      }
    };

    recognition.onerror = (event) => {
      skipEndProcessingRef.current = true;
      if (event.error === 'aborted') {
        setState('idle');
        return;
      }
      if (event.error === 'no-speech') {
        setLastSentTranscript('');
        setErrorMessage(
          'No se detectó voz. El micrófono está activo pero no llegó audio. Probá hablar más fuerte o revisá el micrófono del sistema.',
        );
        setState('error');
        setTimeout(() => setState('idle'), 6000);
        return;
      }
      if (event.error === 'not-allowed') {
        setErrorMessage('Permiso de micrófono denegado. Habilitá el micrófono para este sitio en el navegador.');
      } else {
        setErrorMessage(`Error del micrófono (${event.error}). Verificá permisos y dispositivo de audio.`);
      }
      setState('error');
      setTimeout(() => setState('idle'), 6000);
    };

    recognition.onend = () => {
      if (skipEndProcessingRef.current) {
        skipEndProcessingRef.current = false;
        return;
      }
      const finalText = transcriptRef.current.trim() || liveTranscriptRef.current.trim();
      void processTranscript(finalText);
    };

    try {
      recognition.start();
    } catch {
      skipEndProcessingRef.current = true;
      setErrorMessage('No se pudo iniciar el micrófono. Verificá los permisos del navegador.');
      setState('error');
      setTimeout(() => setState('idle'), 4000);
    }
  }, [isSupported, processTranscript]);

  const tooltipText: Record<VoiceState, string> = {
    idle: isSupported ? 'Dictar gasto por voz' : 'Dictado no disponible en este navegador',
    listening: 'Escuchando… hacé clic para detener',
    processing: 'Interpretando dictado…',
    error: errorMessage ?? 'Error',
    success: 'Dictado aplicado al formulario',
  };

  const isProcessing = state === 'processing';
  const isListening = state === 'listening';

  const displayValue =
    liveTranscript ||
    lastSentTranscript ||
    (state === 'listening' ? '' : '');

  const recordingButtonClass =
    '!bg-red-600 !text-white !border-red-600 hover:!bg-red-700 hover:!text-white focus:!bg-red-600 focus:!text-white [&_svg]:!text-white [&_span]:!text-white animate-pulse';

  return (
    <div className="flex flex-col gap-3 w-full sm:w-auto sm:min-w-[280px]">
      <div className="relative self-start">
        <Button
          type="button"
          variant={state === 'error' ? 'danger' : state === 'success' ? 'primary' : 'outline'}
          size="sm"
          onClick={handleClick}
          disabled={disabled || isProcessing}
          title={tooltipText[state]}
          aria-label={tooltipText[state]}
          className={isListening ? recordingButtonClass : undefined}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Interpretando…</span>
            </>
          ) : isListening ? (
            <>
              <MicOff className="h-4 w-4" />
              <span>Detener</span>
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              <span>Dictar gasto</span>
            </>
          )}
        </Button>

        {isListening && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white animate-ping" />
        )}
      </div>

      <div className="rounded-lg border border-mist bg-white p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="voice-debug-transcript" className="text-xs font-semibold text-ink">
            Lo que escucha el micrófono
          </label>
          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              state === 'listening'
                ? 'bg-red-100 text-red-700'
                : state === 'processing'
                  ? 'bg-amber-100 text-amber-800'
                  : state === 'error'
                    ? 'bg-red-100 text-red-700'
                    : state === 'success'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-mist text-slate2'
            }`}
          >
            {STATUS_LABEL[state]}
          </span>
        </div>
        <textarea
          id="voice-debug-transcript"
          readOnly
          rows={3}
          value={displayValue}
          placeholder={
            isListening
              ? 'Hablá ahora… acá aparece en vivo lo que transcribe el navegador.'
              : 'Presioná «Dictar gasto» y hablá. Acá vas a ver el texto crudo que captura el micrófono.'
          }
          className={`w-full min-h-[72px] resize-y rounded-lg border px-3 py-2 text-sm text-ink bg-white outline-none ${
            isListening ? 'border-red-300 ring-1 ring-red-200' : 'border-mist'
          } ${!displayValue ? 'text-slate2 italic' : ''}`}
        />
        {lastSentTranscript && state !== 'listening' && (
          <p className="text-[11px] text-slate2">
            Enviado al interpretador: <span className="font-medium text-ink">«{lastSentTranscript}»</span>
          </p>
        )}
        {errorMessage && (
          <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
