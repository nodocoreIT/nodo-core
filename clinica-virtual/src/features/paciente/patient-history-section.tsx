import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@nodocore/shared-components";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  History,
  FileText,
  Download,
  Stethoscope,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/shared/lib/supabase";
import { getDocumentPublicUrl } from "@/shared/lib/storage";

interface HistoryDocument {
  id: string;
  file_name: string;
  uploaded_at: string;
  file_path: string;
  publicUrl?: string;
}

interface HistoryAppointment {
  id: string;
  scheduled_at: string;
  status: string;
  doctor: { full_name: string; specialty: string | null } | null;
  documents: HistoryDocument[];
  clinicalNote: string | null;
}

interface ClinicalRecord {
  id: string;
  title: string;
  content: string;
  record_type: string;
  created_at: string;
  doctorName?: string;
}

interface PatientHistorySectionProps {
  patientId: string;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programado",
  waiting: "En espera",
  in_consultation: "En consulta",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

export function PatientHistorySection({ patientId }: PatientHistorySectionProps) {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<HistoryAppointment[]>([]);
  const [records, setRecords] = useState<ClinicalRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: apts }, { data: recs }] = await Promise.all([
        supabase
          .from("appointments")
          .select(`
            id, scheduled_at, status,
            doctor:profiles!doctor_id(full_name, specialty),
            patient_documents(id, file_name, uploaded_at, file_path),
            clinical_notes(content)
          `)
          .eq("patient_id", patientId)
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("clinical_records")
          .select(`
            id, title, content, record_type, created_at,
            doctor:profiles!doctor_id(full_name)
          `)
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false }),
      ]);

      if (apts) {
        const mapped = await Promise.all(
          apts.map(async (apt) => {
            const docs = apt.patient_documents as unknown as HistoryDocument[] ?? [];
            const docsWithUrls = await Promise.all(
              docs.map(async (d) => ({
                ...d,
                publicUrl: await getDocumentPublicUrl(d.file_path),
              }))
            );
            const notes = apt.clinical_notes as unknown as { content: string }[] ?? [];
            return {
              id: apt.id,
              scheduled_at: apt.scheduled_at,
              status: apt.status,
              doctor: apt.doctor as unknown as { full_name: string; specialty: string | null } | null,
              documents: docsWithUrls,
              clinicalNote: notes[0]?.content ?? null,
            };
          })
        );
        setAppointments(mapped);
      }

      if (recs) {
        setRecords(
          recs.map((r) => ({
            id: r.id,
            title: r.title,
            content: r.content,
            record_type: r.record_type,
            created_at: r.created_at,
            doctorName: (r.doctor as unknown as { full_name?: string } | null)?.full_name,
          }))
        );
      }

      setLoading(false);
    };

    void load();
  }, [patientId]);

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5 text-emerald-600" />
          Mi historial clínico
        </CardTitle>
        <p className="text-sm text-slate-500">
          Consultas, archivos subidos e informes de tus médicos
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="consultas">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="consultas">Consultas</TabsTrigger>
            <TabsTrigger value="informes">Informes médicos</TabsTrigger>
          </TabsList>

          <TabsContent value="consultas" className="mt-4 space-y-3">
            {appointments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                Todavía no tenés consultas registradas
              </p>
            ) : (
              appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/50 p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium text-slate-800 flex items-center gap-1.5">
                        <Stethoscope className="h-4 w-4 text-blue-600" />
                        Dr/a. {apt.doctor?.full_name ?? "Médico"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {apt.doctor?.specialty} ·{" "}
                        {format(new Date(apt.scheduled_at), "dd MMM yyyy HH:mm", {
                          locale: es,
                        })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {STATUS_LABELS[apt.status] ?? apt.status}
                    </Badge>
                  </div>

                  {apt.documents.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-slate-500">
                        Archivos que subiste:
                      </p>
                      {apt.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 text-xs bg-white rounded px-2 py-1.5 border border-slate-100"
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-500" />
                          <span className="truncate flex-1">{doc.file_name}</span>
                          <a
                            href={doc.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-slate-100"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {apt.clinicalNote && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 bg-white rounded px-2 py-1.5 border border-slate-100">
                      {apt.clinicalNote}
                    </p>
                  )}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="informes" className="mt-4 space-y-3">
            {records.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                Sin informes clínicos todavía
              </p>
            ) : (
              records.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/50 p-4"
                >
                  <p className="font-medium text-slate-800 text-sm">{rec.title}</p>
                  <p className="text-xs text-slate-400 mb-2">
                    {format(new Date(rec.created_at), "dd MMM yyyy", { locale: es })}
                    {rec.doctorName && ` · Dr/a. ${rec.doctorName}`}
                  </p>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-4">
                    {rec.content}
                  </p>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
