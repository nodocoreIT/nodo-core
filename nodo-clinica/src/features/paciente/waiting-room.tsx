import { useEffect, useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from "@nodocore/shared-components";
import {
  Upload,
  Users,
  FileText,
  CheckCircle,
  Loader2,
  Video,
  ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/shared/lib/supabase";
import { toast } from "sonner";
import { formatTime } from "@/shared/lib/utils";
import type { Appointment } from "@/types";
import { JitsiMeet, ConsultationEndScreen } from "@/features/consultation/jitsi-meet";
import { DocumentUpload } from "@/features/paciente/document-upload";
import { WaitingRoomIntake } from "@/features/paciente/waiting-room-intake";
import { ConsultationPaymentPanel } from "@/features/paciente/consultation-payment-panel";

interface WaitingRoomProps {
  accessToken: string;
}

export function WaitingRoom({ accessToken }: WaitingRoomProps) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const lastStatusRef = useRef<string | null>(null);
  const notifiedRef = useRef(false);

  const loadAppointment = useCallback(async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        patient:patients(id, profile:profiles(full_name)),
        doctor:profiles!doctor_id(full_name, specialty)
      `)
      .eq("access_token", accessToken)
      .single();

    if (error || !data) {
      setIsLoading(false);
      return;
    }

    const apt = data as unknown as Appointment;

    if (new Date(apt.token_expires_at) < new Date()) {
      toast.error("El enlace ha expirado");
      setIsLoading(false);
      return;
    }

    setAppointment(apt);

    if (apt.status === "scheduled") {
      await supabase
        .from("appointments")
        .update({ status: "waiting" })
        .eq("id", apt.id);
    }

    const { count: ahead } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", apt.doctor_id)
      .in("status", ["waiting", "in_consultation"])
      .lt("queue_position", apt.queue_position);

    setQueuePosition((ahead ?? 0) + 1);

    const { count: total } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", apt.doctor_id)
      .eq("status", "waiting");

    setTotalWaiting(total ?? 0);
    setIsLoading(false);
  }, [accessToken]);

  useEffect(() => {
    void loadAppointment();
  }, [loadAppointment]);

  useEffect(() => {
    if (!appointment) return;

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
          if (
            updated.status === "in_consultation" &&
            lastStatusRef.current !== "in_consultation" &&
            !notifiedRef.current
          ) {
            notifiedRef.current = true;
            toast.success("¡El médico está listo! Ingresando a la consulta...");
          }
          lastStatusRef.current = updated.status;
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accessToken, appointment]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-slate-600">Enlace inválido o expirado</p>
            <Link to="/paciente">
              <Button variant="outline" size="sm">
                Volver al portal
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const doctorProfile = appointment.doctor as
    | { full_name?: string; specialty?: string }
    | undefined;
  const patientProfile = appointment.patient as
    | { profile?: { full_name?: string } }
    | undefined;

  const patientName = patientProfile?.profile?.full_name ?? "Paciente";
  const doctorName = doctorProfile?.full_name ?? "Médico";
  const doctorSpecialty = doctorProfile?.specialty;

  const isInConsultation = appointment.status === "in_consultation";
  const isCompleted = appointment.status === "completed" || videoEnded;

  const backLink = (
    <Link
      to="/paciente"
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"
    >
      <ArrowLeft className="h-4 w-4" />
      Volver al portal
    </Link>
  );

  if (isInConsultation && !videoEnded) {
    return (
      <div className="min-h-screen bg-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          {backLink}
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white text-xs font-semibold px-3 py-1">
              <Video className="h-3 w-3" />
              Consulta en curso
            </span>
            <p className="text-white/70 text-sm mt-2">
              Con Dr/a. {doctorName}
            </p>
          </div>
          <JitsiMeet
            roomName={appointment.jitsi_room_id}
            displayName={patientName}
            height={560}
            onMeetingEnd={() => setVideoEnded(true)}
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-paper p-4">
        <div className="max-w-md w-full">
          {backLink}
          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-navy">
                Consulta finalizada
              </h2>
              <p className="text-sm text-slate2 mt-2">
                Gracias por utilizar Nodo Clínica.
              </p>
              <Link to="/paciente">
                <Button className="mt-6 bg-emerald-600 hover:bg-emerald-700">
                  Volver al portal
                </Button>
              </Link>
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
    <div className="min-h-screen bg-gradient-to-b from-paper to-blue-50/30">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {backLink}

        <div className="text-center">
          <h1 className="text-xl font-semibold text-navy">
            Sala de Espera Virtual
          </h1>
          <p className="text-sm text-slate2 mt-1">
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
                <p className="text-3xl font-bold text-brand">
                  #{queuePosition}
                </p>
                <p className="text-xs text-slate2">Posición en la fila</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-700">
                  Dr/a. {doctorName}
                </p>
                {doctorSpecialty && (
                  <p className="text-xs text-slate2">{doctorSpecialty}</p>
                )}
                <p className="text-xs text-slate2 mt-1">
                  {formatTime(appointment.scheduled_at)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate2 mb-1">
                <span>Progreso de la fila</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {totalWaiting} en espera
                </span>
              </div>
              <div className="h-2 rounded-full bg-mist overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Upload className="h-4 w-4 text-brand" />
              Estudios previos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate2">
              Suba sus estudios médicos (PDF, JPG, PNG) para que el médico los
              revise antes de la consulta.
            </p>
            <DocumentUpload
              patientId={appointment.patient_id}
              appointmentId={appointment.id}
            />
          </CardContent>
        </Card>

        <WaitingRoomIntake accessToken={accessToken} />

        <p className="text-center text-xs text-slate2">
          <FileText className="h-3.5 w-3.5 inline mr-1" />
          Será notificado automáticamente cuando el médico esté disponible
        </p>
      </div>
    </div>
  );
}
