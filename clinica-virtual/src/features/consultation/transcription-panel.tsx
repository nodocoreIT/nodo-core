import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@nodocore/shared-components";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useConsultationStore } from "@/store/consultation-store";
import { toast } from "sonner";

interface TranscriptionPanelProps {
  appointmentId: string;
}

export function TranscriptionPanel({ appointmentId: _appointmentId }: TranscriptionPanelProps) {
  const { transcriptionText, appendTranscription, isTranscribing, setIsTranscribing } =
    useConsultationStore();
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }
  }, []);

  const startTranscription = () => {
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "es-AR";

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.isFinal) {
          const text = result[0]?.transcript ?? "";
          appendTranscription({
            speaker: "unknown",
            text,
            timestamp: new Date().toISOString(),
          });
        }
      }
    };

    recognition.onerror = (event) => {
      toast.error(`Error en transcripción: ${event.error}`);
      setIsTranscribing(false);
    };

    recognition.onend = () => {
      if (isTranscribing) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsTranscribing(true);
  };

  const stopTranscription = () => {
    setIsTranscribing(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  };

  if (!supported) {
    return (
      <Card className="border-slate-200">
        <CardContent className="pt-4 text-sm text-slate-500">
          Transcripción no disponible en este navegador. Use Chrome o Edge.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm font-medium flex items-center justify-between text-slate-700">
          <span className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-brand" />
            Transcripción
          </span>
          {isTranscribing ? (
            <Button size="sm" variant="outline" onClick={stopTranscription} className="h-7 text-xs">
              <MicOff className="h-3.5 w-3.5 mr-1 text-red-500" />
              Detener
            </Button>
          ) : (
            <Button size="sm" onClick={startTranscription} className="h-7 text-xs bg-brand hover:bg-brand-600">
              <Mic className="h-3.5 w-3.5 mr-1" />
              Iniciar
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {isTranscribing && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 mb-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Escuchando…
          </div>
        )}
        <div className="max-h-48 overflow-y-auto rounded bg-slate-50 p-2 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
          {transcriptionText || (
            <span className="text-slate-400 italic">
              La transcripción aparecerá aquí al iniciar.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
