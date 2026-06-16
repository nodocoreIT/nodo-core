"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Loader2, Save, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { clinicApi } from "@/lib/clinic/client-api";

interface WaitingRoomIntakeProps {
  accessToken: string;
  initialValue?: string;
}

export function WaitingRoomIntake({
  accessToken,
  initialValue = "",
}: WaitingRoomIntakeProps) {
  const [text, setText] = useState(initialValue);
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!initialValue);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setText(initialValue);
    setSaved(!!initialValue);
  }, [initialValue]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleMic = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Dictado por voz no disponible en este navegador");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let chunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          chunk += event.results[i][0].transcript;
        }
      }
      if (chunk.trim()) {
        setText((prev) => (prev ? `${prev.trim()} ${chunk.trim()}` : chunk.trim()));
        setSaved(false);
      }
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    toast.message("Escuchando… contá el motivo de tu consulta");
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await clinicApi.saveIntakeReason(accessToken, text.trim());
      setSaved(true);
      toast.success("Motivo guardado — el médico lo verá antes de la consulta");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-violet-200 bg-violet-50/20 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-violet-600" />
          Motivo de consulta (opcional)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          Contanos por qué venís o qué te preocupa. Podés escribir o usar el
          micrófono — el médico lo verá antes de atenderte.
        </p>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          placeholder="Ej: dolor abdominal hace 3 días, necesito renovar receta..."
          className="min-h-[88px] text-sm bg-white"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`flex-1 ${listening ? "border-red-300 text-red-700" : ""}`}
            onClick={toggleMic}
          >
            {listening ? (
              <>
                <MicOff className="h-3.5 w-3.5 mr-1" />
                Detener
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5 mr-1" />
                Dictar
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 bg-violet-700 hover:bg-violet-800"
            disabled={!text.trim() || saving}
            onClick={handleSave}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1" />
                {saved ? "Guardado" : "Guardar"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
