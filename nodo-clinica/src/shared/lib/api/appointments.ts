import { supabase } from "@/shared/lib/supabase";
import type { Appointment, AppointmentStatus, QueuePatient } from "@/types";
import { mapAppointmentStatusToLifecycle } from "@/types";

type AppointmentRow = Appointment & {
  patient?: {
    id: string;
    profile?: { full_name: string; email: string };
  };
};

export async function fetchDoctorQueue(doctorId: string): Promise<QueuePatient[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      *,
      patient:patients(
        id,
        profile:profiles(full_name, email)
      )
    `)
    .eq("doctor_id", doctorId)
    .gte("scheduled_at", today.toISOString())
    .in("status", ["scheduled", "waiting", "in_consultation"])
    .order("queue_position");

  if (error) throw error;
  if (!data) return [];

  return (data as unknown as AppointmentRow[]).map((apt) => ({
    appointmentId: apt.id,
    patientId: apt.patient_id,
    patientName: apt.patient?.profile?.full_name ?? "Paciente",
    patientEmail: apt.patient?.profile?.email,
    status: mapAppointmentStatusToLifecycle(apt.status),
    queuePosition: apt.queue_position,
    scheduledAt: apt.scheduled_at,
  }));
}

export async function fetchPatientAppointments(patientId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select(`*, doctor:profiles(full_name, specialty, license_number)`)
    .eq("patient_id", patientId)
    .order("scheduled_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Appointment[];
}

export async function createAppointment(
  data: Pick<Appointment, "patient_id" | "doctor_id" | "scheduled_at" | "jitsi_room_id" | "access_token" | "token_expires_at">,
): Promise<Appointment> {
  const { data: created, error } = await supabase
    .from("appointments")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return created as unknown as Appointment;
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

export async function saveIntakeReason(
  appointmentId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ intake_reason: reason })
    .eq("id", appointmentId);

  if (error) throw error;
}

export async function confirmPayment(appointmentId: string): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ payment_status: "confirmed" })
    .eq("id", appointmentId);

  if (error) throw error;
}
