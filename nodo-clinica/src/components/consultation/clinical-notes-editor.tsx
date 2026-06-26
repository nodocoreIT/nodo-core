// @ts-nocheck
"use client";

import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2 } from "lucide-react";
import { useConsultationStore } from "@/store/consultation-store";
import { useAutoSave } from "@/hooks/use-auto-save";
import { createClient } from "@/lib/supabase/client";
import { clinicApi } from "@/lib/clinic/client-api";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
        <Badge variant="outline" className="border-slate-200 text-slate-500 text-xs">
          Markdown
        </Badge>
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
        value={clinicalNotes}
        onChange={(e) => setClinicalNotes(e.target.value)}
        placeholder="## Evaluación&#10;- Motivo de consulta:&#10;- Examen físico:&#10;- Diagnóstico:&#10;- Plan:"
        className="flex-1 resize-none font-mono text-sm border-slate-200 focus-visible:ring-blue-500/30 min-h-[280px]"
      />
    </div>
  );
}
