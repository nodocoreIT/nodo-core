import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>;

export type AppointmentStatus =
  | "scheduled"
  | "waiting"
  | "in_consultation"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "confirmed" | "waived";

export interface AppointmentRow {
  id: string;
  org_id: string;
  doctor_id: string;
  professional_id: string;
  patient_id: string;
  scheduled_at: string;
  status: AppointmentStatus;
  queue_position: number;
  jitsi_room_id: string;
  access_token: string;
  token_expires_at: string;
  payment_status: PaymentStatus | null;
  payment_confirmed_at: string | null;
  payment_provider: string | null;
  intake_reason: string | null;
  reminder_sent_at: string | null;
  share_health_profile: boolean | null;
  payment_receipt_audit: Record<string, unknown> | null;
  mercadopago_preference_id: string | null;
  mercadopago_payment_id: string | null;
  confirmation_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentInsert {
  org_id: string;
  doctor_id: string;
  professional_id: string;
  patient_id: string;
  scheduled_at: string;
  status?: AppointmentStatus;
  queue_position?: number;
  jitsi_room_id: string;
  token_expires_at: string;
  payment_status?: PaymentStatus;
  payment_confirmed_at?: string | null;
  payment_provider?: string | null;
  intake_reason?: string | null;
  share_health_profile?: boolean;
  payment_receipt_audit?: Record<string, unknown> | null;
}

export interface AppointmentUpdate {
  status?: AppointmentStatus;
  queue_position?: number;
  payment_status?: PaymentStatus;
  payment_confirmed_at?: string | null;
  intake_reason?: string | null;
  reminder_sent_at?: string | null;
  updated_at?: string;
}

/** Returns appointments filtered by doctor_id scoped to org. */
export async function getAppointments(
  supabase: AnyClient,
  orgId: string,
  filters: {
    doctorId?: string;
    patientId?: string;
    accessToken?: string;
    status?: AppointmentStatus[];
  },
) {
  let query = supabase
    .from("appointments")
    .select("*")
    .eq("org_id", orgId);

  if (filters.doctorId) query = query.eq("doctor_id", filters.doctorId);
  if (filters.patientId) query = query.eq("patient_id", filters.patientId);
  if (filters.accessToken) query = query.eq("access_token", filters.accessToken);
  if (filters.status?.length) query = query.in("status", filters.status);

  return query;
}

/** Returns a single appointment by id. */
export async function getAppointmentById(
  supabase: AnyClient,
  id: string,
  orgId: string,
) {
  return supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
}

/** Returns a single appointment by access_token (no org scope — used for patient waiting room). */
export async function getAppointmentByToken(
  supabase: AnyClient,
  accessToken: string,
) {
  return supabase
    .from("appointments")
    .select("*")
    .eq("access_token", accessToken)
    .maybeSingle();
}

/** Inserts a new appointment row. */
export async function createAppointment(
  supabase: AnyClient,
  data: AppointmentInsert,
) {
  return supabase.from("appointments").insert(data).select().single();
}

/** Updates an appointment row. */
export async function updateAppointment(
  supabase: AnyClient,
  id: string,
  orgId: string,
  data: AppointmentUpdate,
) {
  return supabase
    .from("appointments")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
}

/** Sets an appointment status to 'cancelled'. */
export async function cancelAppointment(
  supabase: AnyClient,
  id: string,
  orgId: string,
) {
  return updateAppointment(supabase, id, orgId, {
    status: "cancelled",
    updated_at: new Date().toISOString(),
  });
}

/** Counts how many appointments a doctor has on or after a given date. */
export async function countAppointmentsForDoctor(
  supabase: AnyClient,
  doctorId: string,
  fromDate: string,
) {
  return supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("doctor_id", doctorId)
    .gte("scheduled_at", fromDate);
}
