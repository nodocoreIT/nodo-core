import { useEffect, useRef, useCallback } from "react";
import { Textarea } from "@nodocore/shared-components";
import { useConsultationStore } from "@/store/consultation-store";
import { upsertClinicalNote } from "@/shared/lib/api/clinical";

interface ClinicalNotesEditorProps {
  appointmentId: string;
  doctorId: string;
}

const AUTOSAVE_DELAY_MS = 2000;

export function ClinicalNotesEditor({
  appointmentId,
  doctorId,
}: ClinicalNotesEditorProps) {
  const {
    clinicalNotes,
    setClinicalNotes,
    setIsSavingNotes,
    setLastSavedAt,
    notesEditorFocusRequest,
  } = useConsultationStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (notesEditorFocusRequest > 0) {
      textareaRef.current?.focus();
    }
  }, [notesEditorFocusRequest]);

  const scheduleSave = useCallback(
    (content: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setIsSavingNotes(true);
        try {
          await upsertClinicalNote(appointmentId, doctorId, content);
          setLastSavedAt(new Date());
        } catch {
          /* silently fail — next keystroke will retry */
        } finally {
          setIsSavingNotes(false);
        }
      }, AUTOSAVE_DELAY_MS);
    },
    [appointmentId, doctorId, setIsSavingNotes, setLastSavedAt],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setClinicalNotes(value);
    scheduleSave(value);
  };

  return (
    <Textarea
      ref={textareaRef}
      value={clinicalNotes}
      onChange={handleChange}
      placeholder="Notas clínicas de la consulta… (se guardan automáticamente)"
      className="min-h-[200px] resize-y font-mono text-sm"
    />
  );
}
