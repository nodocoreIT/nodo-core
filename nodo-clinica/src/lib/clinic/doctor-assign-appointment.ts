import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAppointment } from "@/lib/clinic/db/appointments";
import {
  DEFAULT_AVAILABILITY,
  appointmentMatchesScheduleGrid,
  appointmentRangeOverlaps,
  findMatchingInstitutionId,
  formatAppointmentLabelFromIso,
  localDateKeyFromIso,
} from "@/lib/clinic/schedule";
import { resolvePresencialAvailability } from "@/lib/clinic/presencial-schedule";
import { doctorRequiresPayment, isPaymentConfirmed } from "@/lib/clinic/payment";
import { isSubscriptionActive } from "@/lib/clinic/trial";
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
  /** auth.users.id of the médico making the request — used to block a médico
   * from assigning a turno to a patient account that shares their own
   * auth identity (professionals.user_id / patients.profile_id can be the
   * same id on purpose, see 20260742_professionals_patients_paused_at.sql). */
  doctorUserId?: string;
  orgId: string;
  patientId: string;
  patientEmail?: string;
  scheduledAtList: string[];
  intakeReason?: string;
  /** Overrides the doctor's default payment requirement for this specific assignment. */
  requirePayment?: boolean;
  /** "virtual" (default) validates against office_settings.availability; "in_person"
   * validates against the union of the doctor's active institutions' own schedules. */
  appointmentType?: "virtual" | "in_person";
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
    doctorUserId,
    orgId,
    patientId,
    patientEmail: patientEmailOverride,
    scheduledAtList,
    intakeReason,
    requirePayment,
    appointmentType,
  } = input;

  const type: "virtual" | "in_person" =
    appointmentType === "in_person" ? "in_person" : "virtual";

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
      .select("id, org_id, full_name, email, profile_id")
      .eq("id", patientId)
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  if (!professional || !isSubscriptionActive(professional)) {
    throw new Error("Médico no disponible");
  }
  if (!patientRow) {
    throw new Error("Paciente no encontrado");
  }

  // Same-account guard: a médico who also has a patient account under the
  // same auth.users identity can't assign a turno to themselves as patient.
  if (
    doctorUserId &&
    patientRow.profile_id &&
    patientRow.profile_id === doctorUserId
  ) {
    throw new Error("No podés asignarte un turno a vos mismo");
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

  const requiresPayment =
    requirePayment ?? doctorRequiresPayment(doctorForLogic as never);
  const virtualAvailability = doctorForLogic.availability ?? DEFAULT_AVAILABILITY;
  const paymentStatus = requiresPayment ? "pending" : "waived";

  // For in_person, the doctor's presencial hours are the union of all of
  // their active institutions' own schedules (each institution manages its
  // own days/times in Instituciones) — never office_settings.availability,
  // which only covers virtual.
  let presencialInstitutions: Awaited<
    ReturnType<typeof resolvePresencialAvailability>
  >["institutions"] = [];
  let presencialSlotDuration = 30;
  let scheduleToValidate = virtualAvailability;

  if (type === "in_person") {
    const resolved = await resolvePresencialAvailability(supabase, doctorId);
    if (!resolved.enabled) {
      throw new Error("El médico no atiende pacientes de forma presencial");
    }
    if (resolved.institutions.length === 0) {
      throw new Error(
        "El médico no tiene instituciones cargadas para atención presencial",
      );
    }
    presencialInstitutions = resolved.institutions;
    presencialSlotDuration = resolved.schedule.slotDurationMinutes;
    scheduleToValidate = resolved.schedule;
  }

  const { data: existingApts } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, patient_id, appointment_type")
    .eq("doctor_id", doctorId)
    .neq("status", "cancelled");

  const allApts = existingApts ?? [];

  const oneHourMs = 60 * 60 * 1000;
  const created: DoctorAssignAppointmentsResult["created"] = [];
  const baseUrl = appBaseUrl();

  const aptDuration =
    type === "in_person"
      ? presencialSlotDuration
      : (virtualAvailability.slotDurationMinutes ?? 30);

  // A doctor can only be in one place (or one call) at a time, so any
  // existing appointment — virtual or presencial — blocks a new one that
  // overlaps it, regardless of the new appointment's own type. Duration of
  // the *existing* appointment isn't persisted per-row, so it's estimated
  // from its own type (30min default for presencial matches the patient
  // booking flow's same known limitation; virtual uses the doctor's
  // configured slot length).
  for (const scheduledAt of uniqueSlots) {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
      throw new Error("Horario de turno inválido");
    }

    const conflictingApt = allApts.find((a) => {
      const existingDuration =
        a.appointment_type === "in_person"
          ? 30
          : (virtualAvailability.slotDurationMinutes ?? 30);
      return appointmentRangeOverlaps(
        new Date(a.scheduled_at),
        existingDuration,
        when,
        aptDuration,
      );
    });
    if (conflictingApt) {
      throw new Error(
        type === "in_person"
          ? "No podés asignar un turno presencial en ese horario: conflicto con turno existente"
          : "Uno de los horarios elegidos ya está reservado",
      );
    }

    const windowStart = new Date(when.getTime() - oneHourMs).toISOString();
    const windowEnd = new Date(when.getTime() + oneHourMs).toISOString();
    const patientConflict = allApts.some(
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

    if (!appointmentMatchesScheduleGrid(when.toISOString(), scheduleToValidate)) {
      throw new Error("Uno de los horarios está fuera de la agenda del médico");
    }

    const whenDateKey = localDateKeyFromIso(when.toISOString());
    const queueToday = allApts.filter(
      (a) =>
        localDateKeyFromIso(a.scheduled_at) === whenDateKey &&
        isPaymentConfirmed(a as never),
    ).length;

    const now = new Date().toISOString();
    const tokenExpires = new Date(when.getTime() + 24 * 60 * 60 * 1000);

    const matchedInstitutionId =
      type === "in_person"
        ? findMatchingInstitutionId(when.toISOString(), presencialInstitutions)
        : null;
    const matchedInstitution = matchedInstitutionId
      ? presencialInstitutions.find((i) => i.id === matchedInstitutionId) ?? null
      : null;

    const { data: apt, error: insertError } = await createAppointment(supabase, {
      org_id: orgId,
      doctor_id: doctorId,
      professional_id: doctorId,
      patient_id: patientRow.id,
      scheduled_at: when.toISOString(),
      appointment_date: when.toISOString(),
      status: "scheduled",
      queue_position: queueToday + 1,
      // jitsi_room_id is nullable in the real schema for presencial
      // appointments (no video room) — AppointmentInsert's generated type is
      // stale here, same pre-existing mismatch as api/clinic/appointments/route.ts.
      jitsi_room_id: (type === "virtual"
        ? `clinica-${doctorId.slice(-8)}-${Date.now()}-${randomUUID().slice(0, 6)}`
        : null) as string,
      access_token: randomUUID(),
      token_expires_at: tokenExpires.toISOString(),
      payment_status: paymentStatus,
      payment_provider: "transfer",
      payment_confirmed_at: paymentStatus === "waived" ? now : null,
      share_health_profile: false,
      intake_reason: intakeReason ? String(intakeReason).slice(0, 4000) : null,
      payment_receipt_audit: null,
      appointment_type: type,
      institution_id: matchedInstitution?.id ?? null,
      institution_snapshot: matchedInstitution
        ? {
            name: matchedInstitution.name,
            address: matchedInstitution.address,
            city: matchedInstitution.city,
            extra_info: matchedInstitution.extra_info,
          }
        : null,
    });

    if (insertError || !apt) {
      throw new Error(insertError?.message ?? "Error al crear turno");
    }

    allApts.push({
      id: apt.id,
      scheduled_at: when.toISOString(),
      status: "scheduled",
      patient_id: patientRow.id,
      appointment_type: type,
    });

    const scheduledLabel = formatAppointmentLabelFromIso(when.toISOString());
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
