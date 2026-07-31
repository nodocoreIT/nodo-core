"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Mic, MicOff } from "lucide-react";
import { useConsultationStore } from "@/store/consultation-store";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useSpeechTranscription } from "@/hooks/use-speech-transcription";
import { createClient } from "@/lib/supabase/client";
import { clinicApi } from "@/lib/clinic/client-api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface ClinicalNotesEditorProps {
  appointmentId: string;
  doctorId: string;
  dataSource?: "local" | "supabase";
}

export function ClinicalNotesEditor({
  appointmentId,
  doctorId,
  dataSource = "supabase",
}: ClinicalNotesEditorProps) {
  const {
    clinicalNotes,
    setClinicalNotes,
    isSavingNotes,
    setIsSavingNotes,
    lastSavedAt,
    setLastSavedAt,
  } = useConsultationStore();
  const [isRecording, setIsRecording] = useState(false);
  const [interimDictation, setInterimDictation] = useState("");

  const { isSupported: speechSupported } = useSpeechTranscription({
    enabled: isRecording,
    syncToConsultationStore: false,
    onSegment: (seg) =>
      setClinicalNotes(
        clinicalNotes && !clinicalNotes.endsWith("\n")
          ? `${clinicalNotes} ${seg.text}`
          : `${clinicalNotes}${seg.text}`,
      ),
    onInterim: setInterimDictation,
    onError: (msg) => {
      toast.error(msg);
      setIsRecording(false);
      setInterimDictation("");
    },
  });

  const saveNotes = async (content: string) => {
    setIsSavingNotes(true);

    if (dataSource === "local") {
      await clinicApi.saveNotes(appointmentId, doctorId, content);
      setLastSavedAt(new Date());
      setIsSavingNotes(false);
      return;
    }

    const supabase = createClient();

    const { error } = await supabase.from("clinical_notes").upsert(
      {
        appointment_id: appointmentId,
        doctor_id: doctorId,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "appointment_id" }
    );

    if (!error) {
      setLastSavedAt(new Date());
    }
    setIsSavingNotes(false);
  };

  useAutoSave(clinicalNotes, saveNotes, 2000);

  return (
    <div className="flex flex-col h-[320px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`h-6 w-6 ${isRecording ? "border-red-300 text-red-600 bg-red-50" : "border-green-400 text-green-600 bg-green-50"}`}
            disabled={!speechSupported}
            title={speechSupported ? "Dictar por micrófono" : "Usá Chrome o Edge para dictar por voz"}
            onClick={() => {
              if (!speechSupported) {
                toast.error("Usá Chrome o Edge para dictar por voz.");
                return;
              }
              setIsRecording((prev) => !prev);
              if (isRecording) setInterimDictation("");
            }}
          >
            {isRecording ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          </Button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {isSavingNotes ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Guardando...
            </>
          ) : lastSavedAt ? (
            <>
              <Save className="h-3 w-3 text-emerald-500" />
              Guardado {format(lastSavedAt, "HH:mm", { locale: es })}
            </>
          ) : (
            "Autoguardado activo"
          )}
        </div>
      </div>
      <Textarea
        value={
          interimDictation
            ? `${clinicalNotes}${clinicalNotes && !clinicalNotes.endsWith("\n") ? " " : ""}${interimDictation}`
            : clinicalNotes
        }
        onChange={(e) => {
          setInterimDictation("");
          setClinicalNotes(e.target.value);
        }}
        placeholder="## Evaluación&#10;- Motivo de consulta:&#10;- Examen físico:&#10;- Diagnóstico:&#10;- Plan:"
        className="flex-1 resize-none font-mono text-sm border-slate-200 focus-visible:ring-blue-500/30 min-h-[280px]"
      />
      {isRecording && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          Escuchando…
        </p>
      )}
    </div>
  );
}
