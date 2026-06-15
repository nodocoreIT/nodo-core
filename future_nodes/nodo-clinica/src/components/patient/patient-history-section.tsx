"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  History,
  FileText,
  Download,
  Stethoscope,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { clinicApi } from "@/lib/clinic/client-api";

interface HistoryAppointment {
  id: string;
  scheduledAt: string;
  status: string;
  doctor: { fullName: string; specialty: string } | null;
  documents: {
    id: string;
    fileName: string;
    uploadedAt: string;
    downloadUrl: string;
  }[];
  clinicalNote: string | null;
}

interface ClinicalRecord {
  id: string;
  title: string;
  content: string;
  recordType: string;
  createdAt: string;
  doctorName?: string;
}

interface PatientHistorySectionProps {
  patientId: string;
}

export function PatientHistorySection({ patientId }: PatientHistorySectionProps) {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<HistoryAppointment[]>([]);
  const [records, setRecords] = useState<ClinicalRecord[]>([]);

  useEffect(() => {
    clinicApi
      .getPatientHistory(patientId)
      .then((data) => {
        setAppointments(data.appointments ?? []);
        setRecords(data.clinicalRecords ?? []);
      })
      .finally(() => setLoading(false));
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

  const statusLabel: Record<string, string> = {
    scheduled: "Programado",
    waiting: "En espera",
    in_consultation: "En consulta",
    completed: "Finalizado",
    cancelled: "Cancelado",
  };

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
                        Dr/a. {apt.doctor?.fullName ?? "Médico"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {apt.doctor?.specialty} ·{" "}
                        {format(new Date(apt.scheduledAt), "dd MMM yyyy HH:mm", {
                          locale: es,
                        })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {statusLabel[apt.status] ?? apt.status}
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
                          <span className="truncate flex-1">{doc.fileName}</span>
                          <a
                            href={doc.downloadUrl}
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
                    {format(new Date(rec.createdAt), "dd MMM yyyy", { locale: es })}
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
