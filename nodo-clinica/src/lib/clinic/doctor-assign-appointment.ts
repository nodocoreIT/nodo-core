import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createAppointment } from "@/lib/clinic/db/appointments";
import {
  DEFAULT_AVAILABILITY,
  appointmentMatchesScheduleGrid,
  slotKeyFromIso,
  localDateKeyFromIso,
} from "@/lib/clinic/schedule";
import { doctorRequiresPayment, isPaymentConfirmed } from "@/lib/clinic/payment";
import {
  appBaseUrl,
  patientTurnosPaymentUrl,
} from "@/lib/clinic/appointment-payment";
import {
  sendAppointmentConfirmationEmail,
  sendDoctorAssignedAppointmentEmail,
} from "@/lib/email/resend";
import { formatReminderLabel } from "@/lib/email/reminder-label";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>;

export interface DoctorAssignAppointmentsInput {
  supabase: AnyClient;
  doctorId: string;
  orgId: string;
  patientId: string;
  patientEmail?: string;
  scheduledAtList: string[];
  intakeReason?: string;
}

export interface DoctorAssignAppointmentsResult {
  created: Array<{
    id: string;
    scheduledAt: string;
    accessToken: string;
    paymentStatus: string;
    requiresPayment: boolean;
  }>;
  patientEmail: string;
  patientName: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function doctorAssignAppointments(
  input: DoctorAssignAppointmentsInput,
): Promise<DoctorAssignAppointmentsResult> {
  const {
    supabase,
    doctorId,
    orgId,
    patientId,
    patientEmail: patientEmailOverride,
    scheduledAtList,
    intakeReason,
  } = input;

  const uniqueSlots = [
    ...new Set(
      scheduledAtList
        .map((iso) => iso?.trim())
        .filter(Boolean)
        .map((iso) => new Date(iso!).toISOString()),
    ),
  ];

  if (uniqueSlots.length === 0) {
    throw new Error("Elegí al menos un horario");
  }

  const [{ data: professional }, { data: patientRow }] = await Promise.all([
    supabase
      .from("professionals")
      .select("*, office_settings(*)")
      .eq("id", doctorId)
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("patients")
      .select("id, org_id, full_name, email")
      .eq("id", patientId)
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  if (!professional || professional.subscription_status === "expired") {
    throw new Error("Médico no disponible");
  }
  if (!patientRow) {
    throw new Error("Paciente no encontrado");
  }

  const notifyEmail = patientEmailOverride?.trim()
    ? normalizeEmail(patientEmailOverride)
    : normalizeEmail(patientRow.email ?? "");

  if (!notifyEmail || !isValidEmail(notifyEmail)) {
    throw new Error("Ingresá un email válido para el paciente");
  }

  if (notifyEmail !== normalizeEmail(patientRow.email ?? "")) {
    await supabase
      .from("patients")
      .update({ email: notifyEmail })
      .eq("id", patientRow.id)
      .eq("org_id", orgId);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const officeSettings = (professional.office_settings as any) ?? {};
  const doctorForLogic = {
    id: professional.id,
    fullName: professional.full_name,
    email: professional.email,
    payment: officeSettings.payment,
    reminderSettings: officeSettings.reminder_settings,
    availability: officeSettings.availability,
  };

  const requiresPayment = doctorRequiresPayment(doctorForLogic as never);
  const availability = doctorForLogic.availability ?? DEFAULT_AVAILABILITY;
  const paymentStatus = requiresPayment ? "pending" : "waived";

  const { data: existingApts } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, patient_id")
    .eq("doctor_id", doctorId)
    .neq("status", "cancelled");

  const takenSlotKeys = new Set(
    (existingApts ?? []).map((a) => slotKeyFromIso(a.scheduled_at)),
  );

  const oneHourMs = 60 * 60 * 1000;
  const created: DoctorAssignAppointmentsResult["created"] = [];
  const baseUrl = appBaseUrl();

  for (const scheduledAt of uniqueSlots) {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
      throw new Error("Horario de turno inválido");
    }

    const slotKey = slotKeyFromIso(when.toISOString());
    if (takenSlotKeys.has(slotKey)) {
      throw new Error("Uno de los horarios elegidos ya está reservado");
    }

    const windowStart = new Date(when.getTime() - oneHourMs).toISOString();
    const windowEnd = new Date(when.getTime() + oneHourMs).toISOString();
    const patientConflict = (existingApts ?? []).some(
      (a) =>
        a.patient_id === patientRow.id &&
        ["scheduled", "waiting", "in_consultation"].includes(a.status) &&
        a.scheduled_at > windowStart &&
        a.scheduled_at < windowEnd,
    );
    if (patientConflict) {
      throw new Error(
        "El paciente ya tiene un turno activo a menos de 1 hora de uno de los horarios elegidos",
      );
    }

    if (!appointmentMatchesScheduleGrid(when.toISOString(), availability)) {
      throw new Error("Uno de los horarios está fuera de la agenda del médico");
    }

    const whenDateKey = localDateKeyFromIso(when.toISOString());
    const queueToday = (existingApts ?? []).filter(
      (a) =>
        localDateKeyFromIso(a.scheduled_at) === whenDateKey &&
        isPaymentConfirmed(a as never),
    ).length;

    const now = new Date().toISOString();
    const tokenExpires = new Date(when.getTime() + 24 * 60 * 60 * 1000);

    const { data: apt, error: insertError } = await createAppointment(supabase, {
      org_id: orgId,
      doctor_id: doctorId,
      professional_id: doctorId,
      patient_id: patientRow.id,
      scheduled_at: when.toISOString(),
      appointment_date: when.toISOString(),
      status: "scheduled",
      queue_position: queueToday + 1,
      jitsi_room_id: `clinica-${doctorId.slice(-8)}-${Date.now()}-${randomUUID().slice(0, 6)}`,
      access_token: randomUUID(),
      token_expires_at: tokenExpires.toISOString(),
      payment_status: paymentStatus,
      payment_provider: "transfer",
      payment_confirmed_at: paymentStatus === "waived" ? now : null,
      share_health_profile: false,
      intake_reason: intakeReason ? String(intakeReason).slice(0, 4000) : null,
      payment_receipt_audit: null,
    });

    if (insertError || !apt) {
      throw new Error(insertError?.message ?? "Error al crear turno");
    }

    takenSlotKeys.add(slotKey);
    existingApts?.push({
      id: apt.id,
      scheduled_at: when.toISOString(),
      status: "scheduled",
      patient_id: patientRow.id,
    });

    const scheduledLabel = format(when, "EEEE d 'de' MMMM 'a las' HH:mm 'hs'", {
      locale: es,
    });
    const loginUrl = patientTurnosPaymentUrl(apt.access_token, baseUrl);

    if (requiresPayment) {
      sendDoctorAssignedAppointmentEmail({
        patientEmail: notifyEmail,
        patientName: patientRow.full_name,
        doctorName: professional.full_name,
        scheduledAt: scheduledLabel,
        loginUrl,
        consultationFee: doctorForLogic.payment?.consultationFee,
        currency: doctorForLogic.payment?.currency ?? "ARS",
      }).catch((err) =>
        console.error("[Email] doctor-assigned appointment failed", err),
      );
    } else {
      let reminderNote: string | undefined;
      if (doctorForLogic.reminderSettings?.enabled) {
        reminderNote = `Te enviaremos un recordatorio ${formatReminderLabel(
          doctorForLogic.reminderSettings.minutesBefore ?? 1440,
        )} del turno a ${notifyEmail}.`;
      }

      sendAppointmentConfirmationEmail({
        patientEmail: notifyEmail,
        patientName: patientRow.full_name,
        doctorName: professional.full_name,
        scheduledAt: scheduledLabel,
        waitingRoomUrl: loginUrl,
        reminderNote,
      }).catch((err) =>
        console.error("[Email] doctor-assigned confirmation failed", err),
      );
    }

    created.push({
      id: apt.id,
      scheduledAt: when.toISOString(),
      accessToken: apt.access_token,
      paymentStatus,
      requiresPayment,
    });
  }

  return {
    created,
    patientEmail: notifyEmail,
    patientName: patientRow.full_name,
  };
}
