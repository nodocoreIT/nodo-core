import { useEffect, useState } from "react";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { FileText, Download, Loader2, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/shared/lib/supabase";

interface PatientDocument {
  id: string;
  file_name: string;
  mime_type: string;
  uploaded_at: string;
  file_path: string;
}

interface PatientDocumentsPanelProps {
  appointmentId: string;
  refreshKey?: number;
}

export function PatientDocumentsPanel({
  appointmentId,
  refreshKey = 0,
}: PatientDocumentsPanelProps) {
  const [documents, setDocuments] = useState<(PatientDocument & { publicUrl: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    supabase
      .from("patient_documents")
      .select("id, file_name, mime_type, uploaded_at, file_path")
      .eq("appointment_id", appointmentId)
      .order("uploaded_at", { ascending: false })
      .then(({ data }) => {
        if (!data) {
          setDocuments([]);
          return;
        }
        const withUrls = data.map((doc) => {
          const { data: urlData } = supabase.storage
            .from("patient-documents")
            .getPublicUrl(doc.file_path);
          return { ...doc, publicUrl: urlData.publicUrl };
        });
        setDocuments(withUrls);
      })
      .finally(() => setLoading(false));
  }, [appointmentId, refreshKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <FolderOpen className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Sin archivos del paciente</p>
        <p className="text-xs mt-1 text-center px-4">
          El paciente puede subir estudios desde la sala de espera
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[280px] pr-2">
      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
          >
            <FileText className="h-4 w-4 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {doc.file_name}
              </p>
              <p className="text-xs text-slate-400">
                {format(new Date(doc.uploaded_at), "dd MMM yyyy HH:mm", {
                  locale: es,
                })}
              </p>
            </div>
            <a
              href={doc.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
