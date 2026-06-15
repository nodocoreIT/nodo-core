import { useEffect, useCallback, useState } from "react";
import { Button } from "@nodocore/shared-components";
import {
  Stethoscope,
  Pill,
  FlaskConical,
  Brain,
  CheckCircle,
  Mic,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@nodocore/shared-components";
import { toast } from "sonner";
import { useConsultationStore } from "@/store/consultation-store";
import { supabase } from "@/shared/lib/supabase";
import {
  fetchDoctorQueue,
  updateAppointmentStatus,
} from "@/shared/lib/api/appointments";
import { fetchClinicalRecords, fetchClinicalNote } from "@/shared/lib/api/clinical";
import { PatientQueue } from "@/features/dashboard/components/patient-queue";
import { TodayAgendaPanel } from "@/features/dashboard/components/today-agenda-panel";
import { PatientPreviewPanel } from "@/features/dashboard/components/patient-preview-panel";
import { NotificationBell } from "@/features/dashboard/components/notification-bell";
import { PatientSearchHeader } from "@/features/dashboard/components/patient-search-header";
import { JitsiMeet, ConsultationEndScreen } from "@/features/consultation/jitsi-meet";
import { PrescriptionForm } from "@/features/medical/prescription-form";
import { StudyRequestForm } from "@/features/medical/study-request-form";
import { SoapSummaryPanel } from "@/features/consultation/soap-summary-panel";
import { ClinicalNotesEditor } from "@/features/consultation/clinical-notes-editor";
import { TranscriptionPanel } from "@/features/consultation/transcription-panel";
import type { QueuePatient } from "@/types";

type ConsultationTab = "prescription" | "studies" | "soap" | "notes" | "transcription";

export function MedicoDashboard() {
  const { session } = useAuth();
  const doctorId = session?.user.id ?? "";
  const doctorName =
    (session?.user.user_metadata as Record<string, string> | undefined)
      ?.full_name ?? "Médico";

  const {
    activeAppointment,
    setActiveAppointment,
    setDoctorId,
    setQueue,
    setClinicalHistory,
    updatePatientStatus,
    addNotification,
    hasActiveSession,
    dismissConsultation,
  } = useConsultationStore();

  const [previewPatient, setPreviewPatient] = useState<QueuePatient | null>(null);
  const [consultationTab, setConsultationTab] = useState<ConsultationTab>("prescription");

  const loadQueue = useCallback(async () => {
    if (!doctorId) return;
    try {
      const queue = await fetchDoctorQueue(doctorId);
      setQueue(queue);
    } catch {
      toast.error("No se pudo cargar la cola de pacientes");
    }
  }, [doctorId, setQueue]);

  const loadClinicalHistory = useCallback(
    async (patientId: string) => {
      try {
        const records = await fetchClinicalRecords(patientId);
        setClinicalHistory(records);
      } catch {
        /* non-critical */
      }
    },
    [setClinicalHistory],
  );

  const startConsultation = async (appointmentId: string) => {
    const { data: appointment } = await supabase
      .from("appointments")
      .select("*, patient:patients(id, profile:profiles(full_name, email))")
      .eq("id", appointmentId)
      .single();

    if (!appointment) return;

    await updateAppointmentStatus(appointmentId, "in_consultation");
    setActiveAppointment(appointment as Parameters<typeof setActiveAppointment>[0]);
    updatePatientStatus(appointmentId, "en_consulta");
    void loadClinicalHistory(appointment.patient_id as string);

    const note = await fetchClinicalNote(appointmentId);
    if (note?.content) {
      useConsultationStore.getState().setClinicalNotes(note.content);
    }

    toast.success("Consulta iniciada");
    void loadQueue();
  };

  const finishConsultation = useCallback(
    async (appointmentId: string) => {
      await updateAppointmentStatus(appointmentId, "completed");
      updatePatientStatus(appointmentId, "finalizada");
      toast.success("Consulta finalizada");
      void loadQueue();
    },
    [updatePatientStatus, loadQueue],
  );

  const resetConsultation = useCallback(
    async (appointmentId: string) => {
      await updateAppointmentStatus(appointmentId, "waiting");
      setActiveAppointment(null);
      updatePatientStatus(appointmentId, "en_espera");
      toast.success("Turno vuelto a sala de espera");
      void loadQueue();
    },
    [setActiveAppointment, updatePatientStatus, loadQueue],
  );

  const handleDismissConsultation = useCallback(() => {
    dismissConsultation();
    void loadQueue();
  }, [dismissConsultation, loadQueue]);

  useEffect(() => {
    if (!doctorId) return;
    setDoctorId(doctorId);
    void loadQueue();

    const appointmentsChannel = supabase
      .channel("medico-appointments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `doctor_id=eq.${doctorId}`,
        },
        () => void loadQueue(),
      )
      .subscribe();

    const documentsChannel = supabase
      .channel("medico-documents")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "patient_documents",
        },
        (payload) => {
          const doc = payload.new as { appointment_id: string; file_name: string };
          addNotification({
            type: "document_upload",
            title: "Nuevo estudio subido",
            message: `El paciente subió: ${doc.file_name}`,
            appointmentId: doc.appointment_id,
          });
          toast.info("Paciente subió un nuevo estudio", {
            description: doc.file_name,
          });
          void loadQueue();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(appointmentsChannel);
      void supabase.removeChannel(documentsChannel);
    };
  }, [doctorId, setDoctorId, loadQueue, addNotification]);

  const patientProfile = activeAppointment?.patient as
    | { profile?: { full_name: string; email: string } }
    | undefined;

  const TABS: { key: ConsultationTab; label: string; Icon: typeof Pill }[] = [
    { key: "prescription", label: "Receta", Icon: Pill },
    { key: "studies", label: "Estudios", Icon: FlaskConical },
    { key: "soap", label: "SOAP", Icon: Brain },
    { key: "notes", label: "Notas", Icon: Stethoscope },
    { key: "transcription", label: "Transcripción", Icon: Mic },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-50 border-b border-mist bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-navy">
                Nodo Clínica
              </h1>
              <p className="text-xs text-slate2">Panel del Médico</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PatientSearchHeader
              doctorId={doctorId}
              onViewPatient={(p) => {
                setPreviewPatient({
                  appointmentId: "",
                  patientId: p.patientId,
                  patientName: p.patientName,
                  patientEmail: p.patientEmail,
                  status: "en_espera",
                  queuePosition: 0,
                  scheduledAt: new Date().toISOString(),
                });
              }}
            />
            <NotificationBell />
            {hasActiveSession() && activeAppointment && (
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => void finishConsultation(activeAppointment.id)}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Finalizar consulta
              </Button>
            )}
            <Link
              to="/medico/configuracion"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate2 hover:text-navy hover:bg-mist transition-colors"
              title="Configuración"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <div className="text-sm font-medium text-slate-800">
              Dr/a. {doctorName}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4 p-4 max-w-[1600px] mx-auto">
        {/* Left: Patient queue */}
        <div className="col-span-12 lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
          <PatientQueue
            onStartConsultation={(id) => void startConsultation(id)}
            onFinishConsultation={(id) => void finishConsultation(id)}
            onResetConsultation={(id) => void resetConsultation(id)}
            onPreviewPatient={setPreviewPatient}
            selectedPreviewId={previewPatient?.appointmentId}
          />
        </div>

        {/* Center: Video / patient preview */}
        <div className="col-span-12 lg:col-span-5 space-y-4 min-h-[500px]">
          {hasActiveSession() && activeAppointment ? (
            <>
              <JitsiMeet
                roomName={activeAppointment.jitsi_room_id}
                displayName={doctorName}
                enableConsultorioBackground
                height={420}
                onMeetingEnd={() => void finishConsultation(activeAppointment.id)}
                endScreen={
                  <ConsultationEndScreen
                    role="doctor"
                    autoRedirectSeconds={0}
                    onReturn={handleDismissConsultation}
                  />
                }
              />

              {/* Tabs */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-200">
                  {TABS.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      onClick={() => setConsultationTab(key)}
                      className={[
                        "flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors",
                        consultationTab === key
                          ? "border-b-2 border-brand text-brand"
                          : "text-slate-500 hover:text-slate-700",
                      ].join(" ")}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="p-3">
                  {consultationTab === "prescription" && (
                    <PrescriptionForm
                      appointmentId={activeAppointment.id}
                      doctorId={doctorId}
                      patientId={activeAppointment.patient_id}
                      patientName={
                        patientProfile?.profile?.full_name ?? "Paciente"
                      }
                      doctorName={doctorName}
                      patientEmail={patientProfile?.profile?.email}
                    />
                  )}
                  {consultationTab === "studies" && (
                    <StudyRequestForm
                      appointmentId={activeAppointment.id}
                      doctorId={doctorId}
                      patientId={activeAppointment.patient_id}
                      patientName={
                        patientProfile?.profile?.full_name ?? "Paciente"
                      }
                      doctorName={doctorName}
                    />
                  )}
                  {consultationTab === "soap" && (
                    <SoapSummaryPanel
                      appointmentId={activeAppointment.id}
                      doctorId={doctorId}
                      onConsultationEnd={() =>
                        void finishConsultation(activeAppointment.id)
                      }
                    />
                  )}
                  {consultationTab === "notes" && (
                    <ClinicalNotesEditor
                      appointmentId={activeAppointment.id}
                      doctorId={doctorId}
                    />
                  )}
                  {consultationTab === "transcription" && (
                    <TranscriptionPanel
                      appointmentId={activeAppointment.id}
                    />
                  )}
                </div>
              </div>
            </>
          ) : (
            <PatientPreviewPanel
              patient={previewPatient}
              onStartConsultation={(id) => id && void startConsultation(id)}
            />
          )}
        </div>

        {/* Right: Today's agenda */}
        <div className="col-span-12 lg:col-span-4 min-h-[500px]">
          <TodayAgendaPanel />
        </div>
      </div>
    </div>
  );
}
