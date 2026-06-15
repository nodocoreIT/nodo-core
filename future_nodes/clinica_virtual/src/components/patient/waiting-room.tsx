"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Users,
  FileText,
  CheckCircle,
  Loader2,
  Video,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import type { Appointment } from "@/types";
import { JitsiMeet } from "@/components/consultation/jitsi-meet";
import { ConsultationEndScreen } from "@/components/consultation/consultation-end-screen";

import { ConsultationPaymentPanel } from "@/components/patient/consultation-payment-panel";
import { WaitingRoomIntake } from "@/components/patient/waiting-room-intake";
import { clinicApi } from "@/lib/clinic/client-api";
import { UserAvatar } from "@/components/ui/user-avatar";

interface WaitingRoomProps {
  accessToken: string;
  dataSource?: "local" | "supabase";
}

interface WaitingMeta {
  patientName: string;
  patientPhoto?: string;
  doctorName: string;
  doctorPhoto?: string;
  doctorSpecialty?: string;
  doctorPayment?: {
    consultationFee?: number;
    currency?: string;
    alias?: string;
    cbu?: string;
    paymentInstructions?: string;
    qrImageData?: string;
  };
}

export function WaitingRoom({
  accessToken,
  dataSource = "supabase",
}: WaitingRoomProps) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<
    { id?: string; name: string; uploadedAt: string; downloadUrl?: string }[]
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [meta, setMeta] = useState<WaitingMeta | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | undefined>();
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentAck, setPaymentAck] = useState(false);
  const [intakeReason, setIntakeReason] = useState("");
  const [videoEnded, setVideoEnded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastStatusRef = useRef<string | null>(null);
  const notifiedConsultationRef = useRef(false);
  const mpReturnHandled = useRef(false);
  const searchParams = useSearchParams();

  const [loadError, setLoadError] = useState<string | null>(null);

  const isTokenValid = (apt: {
    tokenExpiresAt: string;
    scheduledAt: string;
    status: string;
  }) => {
    const now = Date.now();
    if (now <= new Date(apt.tokenExpiresAt).getTime()) return true;
    if (["scheduled", "waiting", "in_consultation"].includes(apt.status)) {
      const graceEnd = new Date(apt.scheduledAt).getTime() + 6 * 60 * 60 * 1000;
      return now <= graceEnd;
    }
    return false;
  };

  const loadAppointment = useCallback(async () => {
    if (dataSource === "local") {
      try {
        setLoadError(null);
        const data = await clinicApi.getAppointmentByToken(accessToken);
        const apt = data.appointment;
        if (!apt) {
          setLoadError("Turno no encontrado");
          setAppointment(null);
          setIsLoading(false);
          return;
        }

        if (!isTokenValid(apt)) {
          setLoadError("El enlace expiró. Pedí un nuevo turno desde el portal.");
          toast.error("El enlace ha expirado");
          setIsLoading(false);
          return;
        }

        setPaymentStatus(apt.paymentStatus);
        setIntakeReason(apt.intakeReason ?? "");

        if (
          apt.status === "scheduled" &&
          (!apt.paymentStatus ||
            apt.paymentStatus === "confirmed" ||
            apt.paymentStatus === "waived")
        ) {
          await clinicApi.updateAppointmentStatus(apt.id, "waiting");
          apt.status = "waiting";
        }

        setAppointment({
          id: apt.id,
          patient_id: apt.patientId,
          doctor_id: apt.doctorId,
          scheduled_at: apt.scheduledAt,
          status: apt.status,
          queue_position: apt.queuePosition,
          jitsi_room_id: apt.jitsiRoomId,
          access_token: apt.accessToken,
          token_expires_at: apt.tokenExpiresAt,
          created_at: apt.createdAt,
          updated_at: apt.updatedAt,
        });
        setMeta({
          patientName: data.patient?.fullName || "Paciente",
          patientPhoto: data.patient?.profilePhotoData,
          doctorName: data.doctor?.fullName || "Médico",
          doctorPhoto: data.doctor?.profilePhotoData,
          doctorSpecialty: data.doctor?.specialty,
          doctorPayment: data.doctor?.payment,
        });
        setQueuePosition(data.queuePosition);
        setTotalWaiting(data.totalWaiting);
        if (data.documents?.length) {
          setUploadedFiles(
            data.documents.map(
              (d: {
                id?: string;
                fileName: string;
                uploadedAt: string;
                downloadUrl?: string;
              }) => ({
                id: d.id,
                name: d.fileName,
                uploadedAt: d.uploadedAt,
                downloadUrl: d.downloadUrl,
              })
            )
          );
        }
      } catch (e) {
        setLoadError(
          e instanceof Error ? e.message : "No se pudo cargar el turno"
        );
        setAppointment(null);
      }
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        patient:patients(id, profile:profiles(full_name)),
        doctor:profiles(full_name, specialty)
      `)
      .eq("access_token", accessToken)
      .single();

    if (error || !data) {
      setIsLoading(false);
      return;
    }

    const appointmentData = data as unknown as Appointment & {
      patient?: { id: string; profile?: { full_name: string } };
      doctor?: { full_name: string; specialty?: string };
    };

    if (new Date(appointmentData.token_expires_at) < new Date()) {
      toast.error("El enlace ha expirado");
      setIsLoading(false);
      return;
    }

    setAppointment(appointmentData);

    if (appointmentData.status === "scheduled") {
      await supabase
        .from("appointments")
        .update({ status: "waiting" })
        .eq("id", appointmentData.id);
    }

    const { count: ahead } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", appointmentData.doctor_id)
      .in("status", ["waiting", "in_consultation"])
      .lt("queue_position", appointmentData.queue_position);

    setQueuePosition((ahead || 0) + 1);

    const { count: total } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", appointmentData.doctor_id)
      .eq("status", "waiting");

    setTotalWaiting(total || 0);
    setIsLoading(false);
  }, [accessToken, dataSource]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !appointment) return;

    setIsUploading(true);

    if (dataSource === "local") {
      const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
      for (const file of Array.from(files)) {
        if (!allowed.includes(file.type)) {
          toast.error(`${file.name}: formato no permitido`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: excede 10 MB`);
          continue;
        }
        try {
          const doc = await clinicApi.uploadDocument(file, accessToken);
          setUploadedFiles((prev) => [
            ...prev,
            {
              id: doc.id,
              name: doc.fileName,
              uploadedAt: doc.uploadedAt,
              downloadUrl: doc.downloadUrl,
            },
          ]);
          toast.success(`${file.name} subido correctamente`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Error al subir");
        }
      }
      setIsUploading(false);
      return;
    }

    const supabase = createClient();

    for (const file of Array.from(files)) {
      const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
      if (!allowed.includes(file.type)) {
        toast.error(`${file.name}: formato no permitido`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: excede 10MB`);
        continue;
      }

      const path = `${appointment.patient_id}/${appointment.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-documents")
        .upload(path, file);

      if (uploadError) {
        toast.error(`Error al subir ${file.name}`);
        continue;
      }

      await supabase.from("patient_documents").insert({
        patient_id: appointment.patient_id,
        appointment_id: appointment.id,
        file_name: file.name,
        file_path: path,
        mime_type: file.type,
      });

      setUploadedFiles((prev) => [
        ...prev,
        { name: file.name, uploadedAt: new Date().toISOString() },
      ]);
      toast.success(`${file.name} subido correctamente`);
    }

    setIsUploading(false);
  };

  useEffect(() => {
    loadAppointment();
  }, [loadAppointment]);

  useEffect(() => {
    const mp = searchParams.get("mp");
    if (!mp || mpReturnHandled.current) return;
    mpReturnHandled.current = true;
    if (mp === "success") {
      toast.success("Pago recibido. Tu turno queda confirmado.");
      void loadAppointment();
    } else if (mp === "pending") {
      toast.message("Pago pendiente — te avisaremos cuando se acredite.");
    } else if (mp === "failure") {
      toast.error("El pago no se completó. Podés intentar de nuevo.");
    }
  }, [searchParams, loadAppointment]);

  useEffect(() => {
    if (!appointment) return;

    if (dataSource === "local") {
      const interval = setInterval(async () => {
        try {
          const data = await clinicApi.getAppointmentByToken(accessToken);
          const apt = data.appointment;
          setAppointment((prev) =>
            prev
              ? {
                  ...prev,
                  status: apt.status,
                }
              : prev
          );
          setQueuePosition(data.queuePosition);
          setTotalWaiting(data.totalWaiting);
          if (
            apt.status === "in_consultation" &&
            lastStatusRef.current !== "in_consultation" &&
            !notifiedConsultationRef.current
          ) {
            notifiedConsultationRef.current = true;
            toast.success("¡El médico está listo! Ingresando a la consulta...");
          }
          lastStatusRef.current = apt.status;
          if (apt.status === "completed") {
            setVideoEnded(true);
          }
          if (data.documents?.length) {
            setUploadedFiles(
              data.documents.map(
                (d: {
                  id?: string;
                  fileName: string;
                  uploadedAt: string;
                  downloadUrl?: string;
                }) => ({
                  id: d.id,
                  name: d.fileName,
                  uploadedAt: d.uploadedAt,
                  downloadUrl: d.downloadUrl,
                })
              )
            );
          }
        } catch {
          /* ignore poll errors */
        }
      }, 3000);
      return () => clearInterval(interval);
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`waiting-${accessToken}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `access_token=eq.${accessToken}`,
        },
        (payload) => {
          const updated = payload.new as Appointment;
          setAppointment((prev) => (prev ? { ...prev, ...updated } : prev));
          if (updated.status === "in_consultation") {
            if (
              lastStatusRef.current !== "in_consultation" &&
              !notifiedConsultationRef.current
            ) {
              notifiedConsultationRef.current = true;
              toast.success("¡El médico está listo! Ingresando a la consulta...");
            }
            lastStatusRef.current = updated.status;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accessToken, appointment, dataSource]);

  const handlePatientVideoEnd = useCallback(async () => {
    setVideoEnded(true);
    if (dataSource !== "local") return;
    try {
      const data = await clinicApi.getAppointmentByToken(accessToken);
      if (data.appointment.status === "completed") {
        setAppointment((prev) =>
          prev ? { ...prev, status: "completed" } : prev
        );
      }
    } catch {
      /* ignore */
    }
  }, [accessToken, dataSource]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-slate-600">
              {loadError || "Enlace inválido o expirado"}
            </p>
            <Link href="/paciente">
              <Button variant="outline" size="sm">
                Volver al portal
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const patientProfile = appointment.patient as
    | { profile?: { full_name: string } }
    | undefined;
  const doctorProfile = appointment.doctor as
    | { full_name: string; specialty?: string }
    | undefined;

  const patientName =
    meta?.patientName || patientProfile?.profile?.full_name || "Paciente";
  const doctorName = meta?.doctorName || doctorProfile?.full_name || "Médico";
  const doctorSpecialty = meta?.doctorSpecialty || doctorProfile?.specialty;

  const isInConsultation = appointment.status === "in_consultation";
  const isCompleted = appointment.status === "completed" || videoEnded;

  const backLink = (
    <Link
      href="/paciente"
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"
    >
      <ArrowLeft className="h-4 w-4" />
      Volver al portal
    </Link>
  );

  const handleConfirmPayment = async () => {
    setConfirmingPayment(true);
    try {
      await clinicApi.confirmAppointmentPayment(accessToken);
      setPaymentStatus("confirmed");
      toast.success("Pago confirmado. Tu turno está activo.");
      await loadAppointment();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al confirmar pago");
    } finally {
      setConfirmingPayment(false);
    }
  };

  if (paymentStatus === "pending") {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-lg mx-auto">
          {backLink}
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="text-lg">Confirmar pago del turno</CardTitle>
              <p className="text-sm text-slate-500">
                Dr/a. {doctorName} — transferí el honorario para activar tu reserva
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ConsultationPaymentPanel
                doctorName={doctorName}
                payment={meta?.doctorPayment}
              />
              <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paymentAck}
                  onChange={(e) => setPaymentAck(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-slate-700">
                  Confirmo que realicé la transferencia
                </span>
              </label>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!paymentAck || confirmingPayment}
                onClick={handleConfirmPayment}
              >
                {confirmingPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar pago y activar turno"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isInConsultation && !videoEnded) {
    return (
      <div className="min-h-screen bg-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          {backLink}
          <div className="text-center mb-4">
            <Badge className="bg-emerald-600 text-white">
              <Video className="h-3 w-3 mr-1" />
              Consulta en curso
            </Badge>
            <p className="text-white/70 text-sm mt-2">
              Con Dr/a. {doctorName}
            </p>
          </div>
          <JitsiMeet
            roomName={appointment.jitsi_room_id}
            displayName={patientName}
            height={560}
            onMeetingEnd={handlePatientVideoEnd}
            endScreen={
              <ConsultationEndScreen
                role="patient"
                doctorName={doctorName}
                autoRedirectSeconds={5}
              />
            }
          />
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full">
          {backLink}
          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-800">
                Consulta finalizada
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                Gracias por utilizar Clínica Virtual.
              </p>
              <Button
                className="mt-6 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  window.location.href = "/paciente";
                }}
              >
                Volver al portal
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const progressPercent =
    totalWaiting > 0
      ? Math.max(10, ((totalWaiting - queuePosition + 1) / totalWaiting) * 100)
      : 50;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/30">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {backLink}
        <div className="text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <UserAvatar
              name={patientName}
              photoUrl={meta?.patientPhoto}
              size="lg"
            />
            <div className="text-slate-300 text-xl">↔</div>
            <UserAvatar
              name={doctorName}
              photoUrl={meta?.doctorPhoto}
              size="lg"
            />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Sala de Espera Virtual
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Hola, {patientName} — consulta con Dr/a. {doctorName}
          </p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">
              Su turno
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-blue-700">
                  #{queuePosition}
                </p>
                <p className="text-xs text-slate-400">Posición en la fila</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-700">
                  Dr/a. {doctorName}
                </p>
                {doctorSpecialty && (
                  <p className="text-xs text-slate-400">
                    {doctorSpecialty}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  {format(new Date(appointment.scheduled_at), "HH:mm 'hs'", {
                    locale: es,
                  })}
                </p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Progreso de la fila</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {totalWaiting} en espera
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <WaitingRoomIntake
          accessToken={accessToken}
          initialValue={intakeReason}
        />

        <ConsultationPaymentPanel
          doctorName={doctorName}
          payment={meta?.doctorPayment}
        />

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-600" />
              Estudios previos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              Suba sus estudios médicos (PDF, JPG, PNG) para que el médico los
              revise antes de la consulta.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />

            <Button
              variant="outline"
              className="w-full border-dashed border-slate-300 h-20 flex flex-col gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              ) : (
                <>
                  <Upload className="h-5 w-5 text-slate-400" />
                  <span className="text-xs text-slate-500">
                    Arrastre o seleccione archivos
                  </span>
                </>
              )}
            </Button>

            {uploadedFiles.length > 0 && (
              <div className="space-y-1.5">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id ?? file.name + file.uploadedAt}
                    className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-md px-3 py-2"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    {file.downloadUrl ? (
                      <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline shrink-0"
                      >
                        Ver
                      </a>
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          Será notificado automáticamente cuando el médico esté disponible
        </p>
      </div>
    </div>
  );
}
