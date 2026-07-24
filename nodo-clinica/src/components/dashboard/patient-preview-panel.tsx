"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  User,
  FileText,
  Paperclip,
  History,
  Loader2,
  Sparkles,
  MessageSquare,
  Play,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ClinicalAlertsBanner } from "@/components/medical/clinical-alerts-banner";
import { clinicApi } from "@/lib/clinic/client-api";
import { LIFECYCLE_COLORS, LIFECYCLE_LABELS } from "@/lib/constants";
import type { PatientLifecycleStatus, QueuePatient } from "@/types";

interface PatientPreviewPanelProps {
  patient: QueuePatient | null;
  doctorId?: string;
  /** Bump this to force a re-fetch of the patient's history (e.g. a new document just arrived in real time). */
  refreshToken?: number;
  onStartConsultation?: (appointmentId: string) => void;
  onGenerateReport?: (patient: QueuePatient) => void;
}

function isPdfFile(fileName: string): boolean {
  return /\.pdf$/i.test(fileName);
}

function isImageFile(fileName: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName);
}

export function PatientPreviewPanel({
  patient,
  doctorId,
  refreshToken,
  onStartConsultation,
  onGenerateReport,
}: PatientPreviewPanelProps) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{
    appointments: Array<{
      id: string;
      scheduledAt: string;
      status: string;
      documents: Array<{ id: string; fileName: string; downloadUrl: string }>;
      clinicalNote?: string | null;
    }>;
    clinicalRecords: Array<{
      id: string;
      title: string;
      content: string;
      recordType: string;
      createdAt: string;
      doctorName?: string;
    }>;
    healthProfile?: import("@/lib/clinic/types").PatientHealthProfile | null;
  } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    fileName: string;
    downloadUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!patient) {
      setHistory(null);
      return;
    }

    let cancelled = false;
    const { patientId, appointmentId } = patient;

    setHistory(null);
    setLoading(true);

    clinicApi
      .getPatientHistory(patientId, doctorId)
      .then((data) => {
        if (cancelled) return;
        if (!data?.appointments || !Array.isArray(data.clinicalRecords)) {
          setHistory({ appointments: [], clinicalRecords: [], healthProfile: null });
          return;
        }
        setHistory(data);
      })
      .catch(() => {
        if (!cancelled) {
          setHistory({ appointments: [], clinicalRecords: [] });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patient?.patientId, patient?.appointmentId, doctorId]);

  const isFirstRefreshRef = useRef(true);
  useEffect(() => {
    if (isFirstRefreshRef.current) {
      isFirstRefreshRef.current = false;
      return;
    }
    if (!patient) return;
    const { patientId, appointmentId } = patient;
    let cancelled = false;
    clinicApi
      .getPatientHistory(patientId, doctorId)
      .then((data) => {
        if (cancelled || !data?.appointments || !Array.isArray(data.clinicalRecords)) return;
        setHistory(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  if (!patient) {
    return (
      <Card className="border-slate-200 h-full">
        <CardContent className="flex flex-col items-center justify-center h-64 text-slate-400 px-6 text-center">
          <User className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">Ficha del paciente</p>
          <p className="text-xs mt-1">
            Seleccioná un paciente en la cola para ver historial, estudios e
            informes antes de la consulta
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentAppointment = history?.appointments?.find(
    (a) => a.id === patient.appointmentId,
  );
  const todayDocs = currentAppointment?.documents ?? [];

  return (
    <>
    <Card className="border-slate-200 h-full shadow-sm">
      <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="flex items-start gap-3">
          <UserAvatar
            name={patient.patientName}
            photoUrl={patient.patientPhoto}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold truncate">
              {patient.patientName}
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Turno{" "}
              {format(new Date(patient.scheduledAt), "EEE d MMM · HH:mm 'hs'", {
                locale: es,
              })}
            </p>
            <Badge
              variant="outline"
              className={`text-[10px] mt-1.5 ${LIFECYCLE_COLORS[patient.status]}`}
            >
              {LIFECYCLE_LABELS[patient.status]}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {(patient.documentCount ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-800">
              <Paperclip className="h-3 w-3 mr-1" />
              {patient.documentCount} archivo{patient.documentCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {(patient.clinicalRecordCount ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px]">
              <History className="h-3 w-3 mr-1" />
              {patient.clinicalRecordCount} registro
              {patient.clinicalRecordCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {patient.intakeReason && (
          <div className="mb-3 rounded-lg border border-violet-100 bg-violet-50/60 p-2.5">
            <p className="text-[10px] font-medium text-violet-700 flex items-center gap-1 mb-1">
              <MessageSquare className="h-3 w-3" />
              Motivo de consulta
            </p>
            <p className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-4">
              {patient.intakeReason}
            </p>
          </div>
        )}
        {history?.healthProfile && (
          <div className="mb-3 space-y-2">
            <ClinicalAlertsBanner
              healthProfile={history.healthProfile}
              patientName={patient.patientName}
              compact
            />
            {(history.healthProfile.heightCm || history.healthProfile.weightKg) && (
              <p className="text-[11px] text-slate-600 px-1">
                {history.healthProfile.heightCm &&
                  `Altura: ${history.healthProfile.heightCm} cm`}
                {history.healthProfile.heightCm &&
                  history.healthProfile.weightKg &&
                  " · "}
                {history.healthProfile.weightKg &&
                  `Peso: ${history.healthProfile.weightKg} kg`}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-3">
          {(patient.status === "en_espera" || patient.status === "programado") &&
            onStartConsultation &&
            patient.appointmentId && (
            <Button
              size="sm"
              className="flex-1 bg-blue-700 hover:bg-blue-800 h-8 text-xs"
              onClick={() => onStartConsultation(patient.appointmentId)}
            >
              <Play className="h-3 w-3 mr-1" />
              Iniciar consulta
            </Button>
          )}
          {onGenerateReport && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-violet-200 text-violet-700"
              onClick={() => onGenerateReport(patient)}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Informe
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <Tabs defaultValue="today" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-100 h-8">
              <TabsTrigger value="today" className="text-[10px]">
                Hoy
              </TabsTrigger>
              <TabsTrigger value="records" className="text-[10px]">
                Historial
              </TabsTrigger>
              <TabsTrigger value="files" className="text-[10px]">
                Archivos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="today" className="mt-3">
              {todayDocs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Sin estudios subidos para este turno todavía
                </p>
              ) : (
                <>
                  <p className="text-[10px] font-medium text-amber-700 flex items-center gap-1 mb-2">
                    <Paperclip className="h-3 w-3" />
                    Estudios adjuntados
                  </p>
                  <ScrollArea className="h-49 pr-2">
                    <div className="space-y-2">
                      {todayDocs.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="flex w-full items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-left hover:bg-amber-50"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          <span className="text-xs text-slate-700 truncate">
                            {doc.fileName}
                          </span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </TabsContent>
            <TabsContent value="records" className="mt-3">
              {!history?.clinicalRecords.length ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Sin historial clínico previo
                </p>
              ) : (
                <ScrollArea className="h-[220px] pr-2">
                  <div className="space-y-2">
                    {history.clinicalRecords.map((rec) => (
                      <div
                        key={rec.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5"
                      >
                        <p className="text-xs font-medium text-slate-800 line-clamp-1">
                          {rec.title}
                        </p>
                        <p className="text-[10px] text-slate-400 mb-1">
                          {format(new Date(rec.createdAt), "dd MMM yyyy", {
                            locale: es,
                          })}
                        </p>
                        <p className="text-[11px] text-slate-600 line-clamp-3 whitespace-pre-wrap">
                          {rec.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
            <TabsContent value="files" className="mt-3">
              {todayDocs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  Sin archivos para este turno
                </p>
              ) : (
                <ScrollArea className="h-[220px] pr-2">
                  <div className="space-y-2">
                    {todayDocs.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="flex w-full items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-700 truncate">
                            {doc.fileName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Turno actual
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>

    <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
      <DialogContent className="flex h-[95vh] max-h-[95vh] w-[95vw] max-w-[95vw] sm:max-w-[95vw] flex-col overflow-hidden">
        <DialogTitle className="truncate pr-6 text-base">{previewDoc?.fileName}</DialogTitle>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-100 bg-slate-50">
          {previewDoc && isPdfFile(previewDoc.fileName) ? (
            <iframe
              src={previewDoc.downloadUrl}
              title={previewDoc.fileName}
              className="h-full w-full"
            />
          ) : previewDoc && isImageFile(previewDoc.fileName) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewDoc.downloadUrl}
              alt={previewDoc.fileName}
              className="mx-auto h-full max-h-full w-auto max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <FileText className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">
                No se puede previsualizar este tipo de archivo.
              </p>
            </div>
          )}
        </div>
        <a
          href={previewDoc?.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-blue-700 hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
          Descargar / abrir en pestaña nueva
        </a>
      </DialogContent>
    </Dialog>
    </>
  );
}
