import type { PaymentStatus } from "@/lib/clinic/db/appointments";
import { isPaymentConfirmed } from "@/lib/clinic/payment";

export type NormalizedAppointmentRow = {
  id: string;
  scheduledAt: string;
  status: string;
  paymentStatus?: PaymentStatus;
  patient?: {
    fullName: string;
    email?: string;
    profilePhotoData?: string;
  };
  documentCount?: number;
  intakeReason?: string;
};

/** Maps API / Supabase appointment payloads to a stable shape for dashboard UI. */
export function normalizeAppointmentRow(
  raw: Record<string, unknown>,
): NormalizedAppointmentRow | null {
  const id = raw.id;
  const scheduledAt = raw.scheduledAt ?? raw.scheduled_at;
  if (typeof id !== "string" || typeof scheduledAt !== "string") {
    return null;
  }

  const patientRaw = (raw.patient ?? raw.patients) as
    | Record<string, unknown>
    | undefined;

  const paymentStatus = (raw.paymentStatus ?? raw.payment_status) as
    | PaymentStatus
    | undefined;

  return {
    id,
    scheduledAt,
    status: String(raw.status ?? "scheduled"),
    paymentStatus,
    patient: patientRaw
      ? {
          fullName: String(
            patientRaw.fullName ?? patientRaw.full_name ?? "Paciente",
          ),
          email:
            typeof patientRaw.email === "string" ? patientRaw.email : undefined,
          profilePhotoData:
            typeof patientRaw.profilePhotoData === "string"
              ? patientRaw.profilePhotoData
              : typeof patientRaw.profilePhotoUrl === "string"
                ? patientRaw.profilePhotoUrl
                : typeof patientRaw.profile_photo_url === "string"
                  ? patientRaw.profile_photo_url
                  : undefined,
        }
      : undefined,
    documentCount:
      typeof raw.documentCount === "number" ? raw.documentCount : undefined,
    intakeReason:
      typeof raw.intakeReason === "string"
        ? raw.intakeReason
        : typeof raw.intake_reason === "string"
          ? raw.intake_reason
          : undefined,
  };
}

export function normalizeAppointmentRows(
  rows: unknown[],
): NormalizedAppointmentRow[] {
  return rows
    .map((row) =>
      normalizeAppointmentRow(row as Record<string, unknown>),
    )
    .filter((row): row is NormalizedAppointmentRow => row !== null)
    .filter((row) => isPaymentConfirmed({ paymentStatus: row.paymentStatus }));
}
