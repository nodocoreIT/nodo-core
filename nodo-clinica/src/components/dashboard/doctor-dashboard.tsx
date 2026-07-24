"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stethoscope, Pill, FlaskConical, Brain, LogOut, CheckCircle, Settings, CalendarPlus } from "lucide-react";
import { PatientQueue } from "@/components/dashboard/patient-queue";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { JitsiMeet } from "@/components/consultation/jitsi-meet";
import { ConsultationEndScreen } from "@/components/consultation/consultation-end-screen";
import { ImmediateActionPanel } from "@/components/consultation/immediate-action-panel";
import { PrescriptionForm } from "@/components/medical/prescription-form";
import { StudyRequestForm } from "@/components/medical/study-request-form";
import { SoapSummaryPanel } from "@/components/medical/soap-summary-panel";
import { DoctorOfficeSidebar } from "@/components/dashboard/doctor-office-sidebar";
import { DoctorPendingPaymentsPanel } from "@/components/dashboard/doctor-pending-payments-panel";
import { PatientPreviewPanel } from "@/components/dashboard/patient-preview-panel";
import { PatientSearchHeader } from "@/components/dashboard/patient-search-header";
import { MedicalReportPanel } from "@/components/medical/medical-report-panel";
import { ClinicalAlertsBanner } from "@/components/medical/clinical-alerts-banner";
import type { PatientHealthProfile } from "@/lib/clinic/types";
import { useConsultationStore } from "@/store/consultation-store";
import { createClient } from "@/lib/supabase/client";
import { clinicApi } from "@/lib/clinic/client-api";
import { mapAppointmentStatusToLifecycle } from "@/types";
import type { Appointment, ClinicalRecord, QueuePatient } from "@/types";
import { toast } from "sonner";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DoctorAssignAppointmentDialog } from "@/components/dashboard/doctor-assign-appointment-dialog";
import type { DoctorAssignAppointmentPrefill } from "@/components/dashboard/doctor-assign-appointment-dialog";

type DataSource = "local" | "supabase";

type AppointmentRow = Appointment & {
  patient?: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    profile_photo_url?: string;
  };
};

interface DoctorDashboardProps {
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
  doctorPhoto?: string;
  dataSource?: DataSource;
  embedded?: boolean;
}

function mapLocalToAppointment(apt: {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  status: string;
  queuePosition: number;
  jitsiRoomId: string;
  accessToken: string;
  tokenExpiresAt: string;
  createdAt: string;
  updatedAt: string;
  patient?: { fullName: string; email: string; id: string };
}): AppointmentRow {
  return {
    id: apt.id,
    patient_id: apt.patientId,
    doctor_id: apt.doctorId,
    scheduled_at: apt.scheduledAt,
    status: apt.status as Appointment["status"],
    queue_position: apt.queuePosition,
    jitsi_room_id: apt.jitsiRoomId,
    access_token: apt.accessToken,
    token_expires_at: apt.tokenExpiresAt,
    created_at: apt.createdAt,
    updated_at: apt.updatedAt,
    patient: apt.patient
      ? ({
          id: apt.patient.id,
          profile_id: apt.patient.id,
          profile: {
            full_name: apt.patient.fullName,
            email: apt.patient.email,
          },
        } as AppointmentRow["patient"])
      : undefined,
  };
}

export function DoctorDashboard({
  doctorId,
  doctorName,
  doctorSpecialty,
  doctorLicense,
  doctorPhoto: doctorPhotoProp,
  dataSource = "supabase",
  embedded = false,
}: DoctorDashboardProps) {
  const router = useRouter();
  const {
    activeAppointment,
    setActiveAppointment,
    setDoctorId,
    setQueue,
    setClinicalHistory,
    updatePatientStatus,
    addNotification,
    isInConsultation,
    hasActiveSession,
    dismissConsultation,
  } = useConsultationStore();
  const [doctorPhoto, setDoctorPhoto] = useState<string | undefined>(doctorPhotoProp);
  const [googleCalendarId, setGoogleCalendarId] = useState<string>();
  const [previewPatient, setPreviewPatient] = useState<QueuePatient | null>(
    null
  );
  const [previewRefreshTick, setPreviewRefreshTick] = useState(0);
  const [inlineReport, setInlineReport] = useState<{
    appointmentId?: string;
    patientId: string;
    patientName: string;
    patientEmail?: string;
    patientPhone?: string;
    postConsult?: boolean;
  } | null>(null);
  const [consultationToolsTab, setConsultationToolsTab] = useState("prescription");
  const [activeHealthProfile, setActiveHealthProfile] =
    useState<PatientHealthProfile | null>(null);
  const [videoSessionKey, setVideoSessionKey] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignPrefillOverride, setAssignPrefillOverride] =
    useState<DoctorAssignAppointmentPrefill | null>(null);
  const { queue } = useConsultationStore();
  const queueRef = useRef(queue);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  const previewPatientRef = useRef(previewPatient);
  useEffect(() => { previewPatientRef.current = previewPatient; }, [previewPatient]);

  useEffect(() => {
    if (dataSource !== "local") return;
    clinicApi.getDoctorSchedule(doctorId).then((data) => {
      if (data.profilePhotoData) setDoctorPhoto(data.profilePhotoData);
      if (data.googleCalendarId) setGoogleCalendarId(data.googleCalendarId);
    });
  }, [doctorId, dataSource]);

  const loadQueue = useCallback(async () => {
    if (dataSource === "local") {
      let rows: unknown;
      try {
        rows = await clinicApi.getDoctorQueue(doctorId);
      } catch {
        toast.error("No se pudo cargar la cola de pacientes");
        return;
      }
      if (!Array.isArray(rows)) {
        toast.error("Error al leer turnos del consultorio");
        return;
      }
      const queue: QueuePatient[] = rows.map(
        (apt: {
          id: string;
          patientId: string;
          queuePosition: number;
          scheduledAt: string;
          status: string;
          documentCount?: number;
          clinicalRecordCount?: number;
          hasNewDocuments?: boolean;
          intakeReason?: string;
          patient?: {
            fullName: string;
            email?: string;
            phone?: string;
            profilePhotoData?: string;
          };
        }) => ({
          appointmentId: apt.id,
          patientId: apt.patientId,
          patientName: apt.patient?.fullName || "Paciente",
          patientEmail: apt.patient?.email,
          patientPhone: apt.patient?.phone,
          patientPhoto: apt.patient?.profilePhotoData,
          status: mapAppointmentStatusToLifecycle(
            apt.status as Appointment["status"]
          ),
          queuePosition: apt.queuePosition,
          scheduledAt: apt.scheduledAt,
          documentCount: apt.documentCount ?? 0,
          clinicalRecordCount: apt.clinicalRecordCount ?? 0,
          hasNewDocuments: apt.hasNewDocuments ?? (apt.documentCount ?? 0) > 0,
          intakeReason: apt.intakeReason,
        })
      );
      setQueue(queue);

      const inConsultation = rows.find(
        (a: { status: string }) => a.status === "in_consultation"
      );
      const current = useConsultationStore.getState().activeAppointment;
      if (inConsultation && !current) {
        setActiveAppointment(mapLocalToAppointment(inConsultation));
      }
      if (!inConsultation && current) {
        setActiveAppointment(null);
      }
      return;
    }

    let rows: unknown;
    try {
      rows = await clinicApi.getDoctorQueue(doctorId);
    } catch {
      toast.error("No se pudo cargar la cola de pacientes");
      return;
    }
    if (!Array.isArray(rows)) {
      toast.error("Error al leer turnos del consultorio");
      return;
    }

    const queue: QueuePatient[] = rows.map(
      (apt: {
        id: string;
        patient_id?: string;
        patientId?: string;
        queue_position?: number;
        queuePosition?: number;
        scheduled_at?: string;
        scheduledAt?: string;
        status: string;
        documentCount?: number;
        hasNewDocuments?: boolean;
        intake_reason?: string;
        intakeReason?: string;
        patient?: {
          id?: string;
          full_name?: string;
          fullName?: string;
          email?: string;
          phone?: string;
          profile_photo_url?: string;
          profilePhotoUrl?: string;
        };
      }) => ({
        appointmentId: apt.id,
        patientId: apt.patient_id ?? apt.patientId ?? "",
        patientName:
          apt.patient?.full_name ?? apt.patient?.fullName ?? "Paciente",
        patientEmail: apt.patient?.email,
        patientPhone: apt.patient?.phone,
        patientPhoto:
          apt.patient?.profile_photo_url ?? apt.patient?.profilePhotoUrl,
        status: mapAppointmentStatusToLifecycle(apt.status as Appointment["status"]),
        queuePosition: apt.queue_position ?? apt.queuePosition ?? 0,
        scheduledAt: apt.scheduled_at ?? apt.scheduledAt ?? "",
        documentCount: apt.documentCount ?? 0,
        hasNewDocuments: apt.hasNewDocuments ?? (apt.documentCount ?? 0) > 0,
        intakeReason: apt.intake_reason ?? apt.intakeReason,
      }),
    );
    setQueue(queue);
  }, [doctorId, setQueue, dataSource]);

  const loadClinicalHistory = useCallback(
    async (patientId: string) => {
      if (dataSource === "local") {
        const data = await clinicApi.getClinicalRecords(patientId);
        setClinicalHistory(
          data.map(
            (r: {
              id: string;
              patient_id: string;
              doctor_id: string;
              record_type: string;
              title: string;
              content: string;
              created_at: string;
              doctor?: { fullName: string };
            }) => ({
              id: r.id,
              patient_id: r.patient_id,
              doctor_id: r.doctor_id,
              record_type: r.record_type,
              title: r.title,
              content: r.content,
              created_at: r.created_at,
              doctor: r.doctor
                ? { full_name: r.doctor.fullName }
                : undefined,
            })
          ) as ClinicalRecord[]
        );
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("clinical_records")
        .select("*, doctor:professionals(full_name)")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) setClinicalHistory(data as ClinicalRecord[]);
    },
    [setClinicalHistory, dataSource]
  );

  const startConsultation = async (appointmentId: string) => {
    if (dataSource === "local") {
      const rows = await clinicApi.getDoctorQueue(doctorId);
      const raw = rows.find((a: { id: string }) => a.id === appointmentId);
      if (!raw) return;

      await clinicApi.updateAppointmentStatus(appointmentId, "in_consultation");
      const apt = mapLocalToAppointment(raw);
      setActiveAppointment(apt);
      updatePatientStatus(appointmentId, "en_consulta");
      loadClinicalHistory(apt.patient_id);

      const history = await clinicApi.getPatientHistory(apt.patient_id, doctorId);
      setActiveHealthProfile(history.healthProfile ?? null);
      if (history.healthProfile?.allergies?.trim()) {
        toast.warning(
          `Alergias registradas: ${history.healthProfile.allergies}`,
          { duration: 10000 },
        );
      }

      const notes = await clinicApi.getNotes(appointmentId);
      if (notes?.content) {
        useConsultationStore.getState().setClinicalNotes(notes.content);
      }
      toast.success("Consulta iniciada");
      loadQueue();
      return;
    }

    const supabase = createClient();

    const { data: appointment } = await supabase
      .from("appointments")
      .select(`
        *,
        patient:patients(id, full_name, email, phone, profile_photo_url)
      `)
      .eq("id", appointmentId)
      .single();

    if (!appointment) return;

    const apt = appointment as unknown as AppointmentRow;
    await supabase
      .from("appointments")
      .update({ status: "in_consultation" })
      .eq("id", appointmentId);

    setActiveAppointment(apt);
    updatePatientStatus(appointmentId, "en_consulta");
    loadClinicalHistory(apt.patient_id);

    const notesRes = await supabase
      .from("clinical_notes")
      .select("content")
      .eq("appointment_id", appointmentId)
      .maybeSingle();

    if (notesRes.data) {
      useConsultationStore.getState().setClinicalNotes(notesRes.data.content);
    }

    toast.success("Consulta iniciada");
  };

  const resetConsultation = useCallback(
    async (appointmentId: string) => {
      if (dataSource === "local") {
        await clinicApi.updateAppointmentStatus(appointmentId, "waiting");
        if (useConsultationStore.getState().activeAppointment?.id === appointmentId) {
          setActiveAppointment(null);
        }
        updatePatientStatus(appointmentId, "en_espera");
        toast.success("Turno vuelto a sala de espera");
        loadQueue();
        return;
      }

      const supabase = createClient();
      await supabase
        .from("appointments")
        .update({ status: "waiting" })
        .eq("id", appointmentId);
      setActiveAppointment(null);
      updatePatientStatus(appointmentId, "en_espera");
      toast.success("Turno vuelto a sala de espera");
      loadQueue();
    },
    [dataSource, loadQueue, setActiveAppointment, updatePatientStatus]
  );

  const clearStuckConsultations = useCallback(async () => {
    if (dataSource === "local") {
      const result = await clinicApi.clearStuckConsultations(doctorId);
      setActiveAppointment(null);
      toast.success(
        result.cleared > 0
          ? `${result.cleared} consulta(s) finalizada(s)`
          : "No había consultas colgadas"
      );
      loadQueue();
      return;
    }

    const supabase = createClient();
    await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("doctor_id", doctorId)
      .eq("status", "in_consultation");
    setActiveAppointment(null);
    toast.success("Consultas colgadas finalizadas");
    loadQueue();
  }, [dataSource, doctorId, loadQueue, setActiveAppointment]);

  const finishConsultation = useCallback(
    async (appointmentId: string) => {
      if (dataSource === "local") {
        const store = useConsultationStore.getState();
        const { transcriptionText, clinicalNotes, activeAppointment, queue } =
          store;
        const queuePatient = queue.find((q) => q.appointmentId === appointmentId);

        await clinicApi.updateAppointmentStatus(appointmentId, "completed", {
          transcription: transcriptionText,
          clinicalNotes,
        });

        const patientId =
          activeAppointment?.patient_id ?? queuePatient?.patientId;
        const patientName = queuePatient?.patientName ?? "Paciente";

        updatePatientStatus(appointmentId, "finalizada");
        setActiveHealthProfile(null);

        if (patientId) {
          setInlineReport({
            appointmentId,
            patientId,
            patientName,
            patientEmail: queuePatient?.patientEmail,
            patientPhone: queuePatient?.patientPhone,
            postConsult: true,
          });
          setPreviewPatient(null);
          dismissConsultation();
        }

        toast.message(
          "Consulta finalizada — dictá el informe y generá con IA cuando estés listo",
        );
        loadQueue();
        return;
      }

      const supabase = createClient();
      await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", appointmentId);

      updatePatientStatus(appointmentId, "finalizada");
      toast.success("Consulta finalizada");
      loadQueue();
    },
    [
      dataSource,
      loadQueue,
      updatePatientStatus,
      dismissConsultation,
    ],
  );

  const openReportForPatient = useCallback(
    (ctx: {
      appointmentId?: string;
      patientId: string;
      patientName: string;
      patientEmail?: string;
      patientPhone?: string;
    }) => {
      if (useConsultationStore.getState().hasActiveSession()) {
        setConsultationToolsTab("report");
        return;
      }
      setInlineReport(ctx);
    },
    []
  );

  const selectPreviewPatient = useCallback((patient: QueuePatient) => {
    setPreviewPatient(patient);
    setInlineReport(null);
  }, []);

  const handleDismissConsultation = useCallback(() => {
    dismissConsultation();
    loadQueue();
  }, [dismissConsultation, loadQueue]);

  const handleSelectSearchedPatient = useCallback(
    (patient: {
      patientId: string;
      patientName: string;
      patientEmail?: string;
      patientPhone?: string;
      patientPhoto?: string;
    }) => {
      const inQueue = useConsultationStore
        .getState()
        .queue.find((q) => q.patientId === patient.patientId);
      setPreviewPatient(
        inQueue ?? {
          appointmentId: "",
          patientId: patient.patientId,
          patientName: patient.patientName,
          patientEmail: patient.patientEmail,
          patientPhone: patient.patientPhone,
          patientPhoto: patient.patientPhoto,
          status: "finalizada",
          queuePosition: 0,
          scheduledAt: new Date().toISOString(),
        }
      );
      setInlineReport(null);
    },
    []
  );

  useEffect(() => {
    setDoctorId(doctorId);
    loadQueue();

    if (dataSource === "local") {
      const interval = setInterval(loadQueue, 3000);
      return () => clearInterval(interval);
    }

    const supabase = createClient();

    const appointmentsChannel = supabase
      .channel("doctor-appointments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "nodo_clinica",
          table: "appointments",
          filter: `doctor_id=eq.${doctorId}`,
        },
        () => loadQueue()
      )
      .subscribe();

    const documentsChannel = supabase
      .channel(`doctor-documents-${doctorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "nodo_clinica",
          table: "patient_documents",
        },
        async (payload) => {
          const doc = payload.new as { appointment_id: string; file_name: string };
          const belongsToDoctor = queueRef.current.some(
            (p) => p.appointmentId === doc.appointment_id
          );
          if (!belongsToDoctor) return;
          addNotification({
            type: "document_upload",
            title: "Nuevo estudio subido",
            message: `El paciente subió: ${doc.file_name}`,
            appointmentId: doc.appointment_id,
          });
          toast.info("Paciente subió un nuevo estudio", {
            description: doc.file_name,
          });
          loadQueue();
          if (previewPatientRef.current?.appointmentId === doc.appointment_id) {
            setPreviewRefreshTick((t) => t + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(documentsChannel);
    };
  }, [doctorId, setDoctorId, loadQueue, addNotification, dataSource]);

  const handleLogout = async () => {
    if (dataSource === "local") {
      await clinicApi.logout();
      router.push("/");
    }
  };

  const patientProfile = activeAppointment?.patient as
    | { profile?: { full_name: string; email: string }; full_name?: string; email?: string }
    | undefined;

  const assignPrefill: DoctorAssignAppointmentPrefill | null =
    hasActiveSession() && activeAppointment
      ? {
          patientId: activeAppointment.patient_id,
          patientName:
            queue.find((q) => q.appointmentId === activeAppointment.id)?.patientName ??
            patientProfile?.full_name ??
            patientProfile?.profile?.full_name ??
            "Paciente",
          patientEmail:
            queue.find((q) => q.appointmentId === activeAppointment.id)?.patientEmail ??
            patientProfile?.email ??
            patientProfile?.profile?.email,
          patientPhoto:
            queue.find((q) => q.appointmentId === activeAppointment.id)?.patientPhoto,
        }
      : null;

  const dialogAssignPrefill = assignPrefillOverride ?? assignPrefill;

  return (
    <div className={embedded ? "bg-paper" : "min-h-screen bg-slate-50"}>
      {!embedded && (
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                Clínica Virtual
              </h1>
              <p className="text-xs text-slate-500">Panel del Médico</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasActiveSession() && activeAppointment && (
              <Button
                size="sm"
                variant="outline"
                className="border-brand/30 text-brand hover:bg-brand/5"
                onClick={() => setAssignOpen(true)}
              >
                <CalendarPlus className="h-4 w-4 mr-1" />
                Asignar turno
              </Button>
            )}
            {hasActiveSession() && activeAppointment && (
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => finishConsultation(activeAppointment.id)}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Finalizar consulta
              </Button>
            )}
            {hasActiveSession() && activeAppointment && dataSource === "local" && (
              <Button
                size="sm"
                className="bg-violet-700 hover:bg-violet-800"
                onClick={() =>
                  openReportForPatient({
                    appointmentId: activeAppointment.id,
                    patientId: activeAppointment.patient_id,
                    patientName:
                      patientProfile?.profile?.full_name || "Paciente",
                    patientEmail: patientProfile?.profile?.email,
                  })
                }
              >
                Informe clínico
              </Button>
            )}
            {dataSource === "local" && (
              <PatientSearchHeader
                doctorId={doctorId}
                onViewPatient={handleSelectSearchedPatient}
                onAssignPatient={(patient) => {
                  setAssignPrefillOverride(patient);
                  setAssignOpen(true);
                }}
              />
            )}
            <NotificationBell />
            {dataSource === "local" && (
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <UserAvatar
                name={doctorName}
                photoUrl={doctorPhoto}
                size="sm"
              />
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-slate-800">
                    Dr/a. {doctorName}
                  </p>
                  {dataSource === "local" && (
                    <button
                      type="button"
                      title="Configuración del consultorio"
                      onClick={() => window.dispatchEvent(new CustomEvent("nodo:open-settings", { detail: { section: "agenda" } }))}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {doctorSpecialty && (
                  <p className="text-xs text-slate-400">{doctorSpecialty}</p>
                )}
              </div>
              {dataSource === "local" && (
                <button
                  type="button"
                  title="Configuración del consultorio"
                  onClick={() => window.dispatchEvent(new CustomEvent("nodo:open-settings", { detail: { section: "agenda" } }))}
                  className="sm:hidden inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      )}

      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <UserAvatar name={doctorName} photoUrl={doctorPhoto} size="sm" />
            <div>
              <p className="text-sm font-semibold text-navy">Dr/a. {doctorName}</p>
              {doctorSpecialty && (
                <p className="text-xs text-slate2">{doctorSpecialty}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasActiveSession() && activeAppointment && (
              <Button
                size="sm"
                variant="outline"
                className="border-brand/30 text-brand hover:bg-brand/5"
                onClick={() => setAssignOpen(true)}
              >
                <CalendarPlus className="h-4 w-4 mr-1" />
                Asignar turno
              </Button>
            )}
            {hasActiveSession() && activeAppointment && (
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => finishConsultation(activeAppointment.id)}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Finalizar consulta
              </Button>
            )}
            {hasActiveSession() && activeAppointment && dataSource === "local" && (
              <Button
                size="sm"
                className="bg-brand hover:bg-brand-600 text-white"
                onClick={() =>
                  openReportForPatient({
                    appointmentId: activeAppointment.id,
                    patientId: activeAppointment.patient_id,
                    patientName:
                      patientProfile?.profile?.full_name || "Paciente",
                    patientEmail: patientProfile?.profile?.email,
                  })
                }
              >
                Informe clínico
              </Button>
            )}
            {dataSource === "local" && (
              <PatientSearchHeader
                doctorId={doctorId}
                onViewPatient={handleSelectSearchedPatient}
                onAssignPatient={(patient) => {
                  setAssignPrefillOverride(patient);
                  setAssignOpen(true);
                }}
              />
            )}
            <NotificationBell />
          </div>
        </div>
      )}

      <div className={`grid grid-cols-12 gap-4 ${embedded ? "" : "p-4 max-w-[1600px] mx-auto"}`}>
        {dataSource === "local" && (
          <div className="col-span-12">
            <DoctorPendingPaymentsPanel
              doctorId={doctorId}
              onConfirmed={() => loadQueue()}
            />
          </div>
        )}
        {/* Cola de pacientes */}
        <div className="col-span-12 lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
          <PatientQueue
            onStartConsultation={startConsultation}
            onFinishConsultation={finishConsultation}
            onResetConsultation={resetConsultation}
            onClearStuck={clearStuckConsultations}
            onPreviewPatient={selectPreviewPatient}
            selectedPreviewId={previewPatient?.appointmentId}
            onGenerateReport={
              dataSource === "local"
                ? (patient) =>
                    openReportForPatient({
                      appointmentId: patient.appointmentId,
                      patientId: patient.patientId,
                      patientName: patient.patientName,
                    })
                : undefined
            }
          />
        </div>

        {/* Centro: ficha del paciente / video consulta */}
        <div className="col-span-12 lg:col-span-6 space-y-4 min-h-[500px]">
          {hasActiveSession() && activeAppointment ? (
            <>
              <ClinicalAlertsBanner
                healthProfile={activeHealthProfile}
                patientName={patientProfile?.profile?.full_name || "Paciente"}
              />
              <JitsiMeet
                key={`${activeAppointment.jitsi_room_id}-${videoSessionKey}`}
                roomName={activeAppointment.jitsi_room_id}
                displayName={doctorName}
                isModerator
                enableConsultorioBackground
                height={520}
                onMeetingEnd={() => {
                  toast.message(
                    "Saliste de la videollamada. Reingresá o usá «Finalizar consulta» cuando termines.",
                  );
                }}
                endScreen={
                  <ConsultationEndScreen
                    role="doctor"
                    autoRedirectSeconds={0}
                    onRejoin={() => setVideoSessionKey((k) => k + 1)}
                    onReturn={handleDismissConsultation}
                    onGenerateReport={() =>
                      openReportForPatient({
                        appointmentId: activeAppointment.id,
                        patientId: activeAppointment.patient_id,
                        patientName:
                          patientProfile?.profile?.full_name || "Paciente",
                        patientEmail: patientProfile?.profile?.email,
                      })
                    }
                  />
                }
              />

              <Tabs
                value={consultationToolsTab}
                onValueChange={setConsultationToolsTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-4 bg-white border border-slate-200">
                  <TabsTrigger value="prescription" className="text-xs gap-1">
                    <Pill className="h-3.5 w-3.5" />
                    Receta
                  </TabsTrigger>
                  <TabsTrigger value="studies" className="text-xs gap-1">
                    <FlaskConical className="h-3.5 w-3.5" />
                    Estudios
                  </TabsTrigger>
                  <TabsTrigger value="soap" className="text-xs gap-1">
                    <Brain className="h-3.5 w-3.5" />
                    SOAP
                  </TabsTrigger>
                  <TabsTrigger value="report" className="text-xs gap-1">
                    <Stethoscope className="h-3.5 w-3.5" />
                    Informe
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="prescription">
                  <PrescriptionForm
                    appointmentId={activeAppointment.id}
                    doctorId={doctorId}
                    patientId={activeAppointment.patient_id}
                    patientName={
                      patientProfile?.profile?.full_name || "Paciente"
                    }
                    doctorName={doctorName}
                    doctorSpecialty={doctorSpecialty}
                    doctorLicense={doctorLicense}
                    patientEmail={patientProfile?.profile?.email}
                    onSaved={() =>
                      loadClinicalHistory(activeAppointment.patient_id)
                    }
                  />
                </TabsContent>
                <TabsContent value="studies">
                  <StudyRequestForm
                    appointmentId={activeAppointment.id}
                    doctorId={doctorId}
                    patientId={activeAppointment.patient_id}
                    patientName={
                      patientProfile?.profile?.full_name || "Paciente"
                    }
                    doctorName={doctorName}
                    doctorSpecialty={doctorSpecialty}
                    doctorLicense={doctorLicense}
                    onSaved={() =>
                      loadClinicalHistory(activeAppointment.patient_id)
                    }
                  />
                </TabsContent>
                <TabsContent value="soap">
                  <SoapSummaryPanel
                    appointmentId={activeAppointment.id}
                    doctorId={doctorId}
                    dataSource={dataSource}
                    onConsultationEnd={() =>
                      finishConsultation(activeAppointment.id)
                    }
                  />
                </TabsContent>
                <TabsContent value="report">
                  <MedicalReportPanel
                    appointmentId={activeAppointment.id}
                    patientId={activeAppointment.patient_id}
                    patientName={
                      patientProfile?.profile?.full_name || "Paciente"
                    }
                    patientEmail={patientProfile?.profile?.email}
                    doctorId={doctorId}
                    doctorName={doctorName}
                    doctorSpecialty={doctorSpecialty}
                    doctorLicense={doctorLicense}
                    onSaved={() => loadClinicalHistory(activeAppointment.patient_id)}
                  />
                </TabsContent>
              </Tabs>

              <ImmediateActionPanel
                appointmentId={activeAppointment.id}
                doctorId={doctorId}
                patientId={activeAppointment.patient_id}
                patientName={patientProfile?.profile?.full_name || "Paciente"}
                patientEmail={patientProfile?.profile?.email}
                doctorName={doctorName}
                doctorSpecialty={doctorSpecialty}
                doctorLicense={doctorLicense}
                dataSource={dataSource}
                onReportSaved={() =>
                  loadClinicalHistory(activeAppointment.patient_id)
                }
              />
            </>
          ) : (
            inlineReport ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-h-[500px]">
                <MedicalReportPanel
                  appointmentId={inlineReport.appointmentId}
                  patientId={inlineReport.patientId}
                  patientName={inlineReport.patientName}
                  patientEmail={inlineReport.patientEmail}
                  patientPhone={inlineReport.patientPhone}
                  doctorId={doctorId}
                  doctorName={doctorName}
                  doctorSpecialty={doctorSpecialty}
                  doctorLicense={doctorLicense}
                  compact
                  postConsult={inlineReport.postConsult}
                  onClose={() => setInlineReport(null)}
                  onSaved={() => {
                    loadClinicalHistory(inlineReport.patientId);
                    setInlineReport(null);
                    setPreviewPatient((p) =>
                      p?.patientId === inlineReport.patientId ? p : previewPatient
                    );
                  }}
                />
              </div>
            ) : (
              <PatientPreviewPanel
                patient={previewPatient}
                doctorId={doctorId}
                refreshToken={previewRefreshTick}
                onStartConsultation={(id) => {
                  if (id) startConsultation(id);
                }}
                onGenerateReport={(patient) =>
                  openReportForPatient({
                    appointmentId: patient.appointmentId || undefined,
                    patientId: patient.patientId,
                    patientName: patient.patientName,
                    patientEmail: patient.patientEmail,
                    patientPhone: patient.patientPhone,
                  })
                }
              />
            )
          )}
        </div>

        {/* Derecha: Mi consultorio + calendario */}
        <div className="col-span-12 lg:col-span-3 min-h-[500px]">
          {dataSource === "local" ? (
            <DoctorOfficeSidebar
              queue={queue}
              googleCalendarId={googleCalendarId}
            />
          ) : hasActiveSession() && activeAppointment ? (
            <ImmediateActionPanel
              appointmentId={activeAppointment.id}
              doctorId={doctorId}
              patientId={activeAppointment.patient_id}
              patientName={patientProfile?.profile?.full_name || "Paciente"}
              patientEmail={patientProfile?.profile?.email}
              doctorName={doctorName}
              doctorSpecialty={doctorSpecialty}
              doctorLicense={doctorLicense}
              dataSource={dataSource}
              onReportSaved={() =>
                loadClinicalHistory(activeAppointment.patient_id)
              }
            />
          ) : (
            <ImmediateActionPanel
              appointmentId=""
              doctorId={doctorId}
              dataSource={dataSource}
            />
          )}
        </div>
      </div>

      <DoctorAssignAppointmentDialog
        doctorId={doctorId}
        doctorName={doctorName}
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) setAssignPrefillOverride(null);
        }}
        prefill={dialogAssignPrefill}
        prefillMode={assignPrefillOverride ? "search" : assignPrefill ? "consultation" : undefined}
        onAssigned={() => void loadQueue()}
      />
    </div>
  );
}
