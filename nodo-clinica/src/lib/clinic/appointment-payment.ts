import { createServiceClient } from "@/lib/supabase/server";
import { notifyDoctorMercadoPagoPayment } from "@/lib/clinic/doctor-notifications";
import { sendAppointmentConfirmationEmail } from "@/lib/email/resend";
import { formatReminderLabel } from "@/lib/email/reminder-label";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function appBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }
  return "http://localhost:3002";
}

/** Login entry for patients (opens "Soy Paciente" tab). */
export function patientLoginUrl(baseUrl: string = appBaseUrl()) {
  return `${baseUrl.replace(/\/$/, "")}/login?role=paciente`;
}

export async function confirmAppointmentPaymentAndNotify(
  appointmentId: string,
  opts?: { mercadopagoPaymentId?: string },
): Promise<Record<string, unknown> | null> {
  const supabase = await createServiceClient();

  const { data: apt, error: aptError } = await supabase
    .from("appointments")
    .select("*, patients(full_name, email), professionals!appointments_doctor_id_fkey(full_name, org_id)")
    .eq("id", appointmentId)
    .maybeSingle();

  if (aptError || !apt) return null;

  if (
    apt.payment_status === "confirmed" ||
    apt.payment_status === "waived"
  ) {
    return apt;
  }

  const now = new Date().toISOString();
  const wasPending = apt.payment_status === "pending";

  const { data: updated, error: updateError } = await supabase
    .from("appointments")
    .update({
      payment_status: "confirmed",
      payment_confirmed_at: now,
      updated_at: now,
      ...(opts?.mercadopagoPaymentId
        ? { mercadopago_payment_id: opts.mercadopagoPaymentId }
        : {}),
    })
    .eq("id", appointmentId)
    .select()
    .single();

  if (updateError || !updated) return null;
  if (!wasPending) return updated;

  // Fetch related data for notifications/email
  const { data: patient } = await supabase
    .from("patients")
    .select("full_name, email")
    .eq("id", apt.patient_id)
    .maybeSingle();

  const { data: officeSettings } = await supabase
    .from("office_settings")
    .select("payment, reminder_settings")
    .eq("professional_id", apt.doctor_id)
    .maybeSingle();

  const { data: professional } = await supabase
    .from("professionals")
    .select("full_name")
    .eq("id", apt.doctor_id)
    .maybeSingle();

  if (!patient || !professional) return updated;

  const payment = (officeSettings?.payment as Record<string, unknown>) ?? {};
  const reminderSettings = (officeSettings?.reminder_settings as {
    enabled?: boolean;
    minutesBefore?: number;
  } | null) ?? {};

  const scheduledLabel = format(
    new Date(apt.scheduled_at),
    "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
    { locale: es },
  );

  let reminderNote: string | undefined;
  if (reminderSettings.enabled) {
    reminderNote = `Te enviaremos un recordatorio ${formatReminderLabel(
      reminderSettings.minutesBefore ?? 1440,
    )} del turno a ${patient.email}.`;
  }

  sendAppointmentConfirmationEmail({
    patientEmail: patient.email,
    patientName: patient.full_name,
    doctorName: professional.full_name,
    scheduledAt: scheduledLabel,
    waitingRoomUrl: `${appBaseUrl()}/paciente/sala/${apt.access_token}`,
    reminderNote,
  }).catch((err) => console.error("[Email] confirmation after MP payment", err));

  const fee = typeof payment.consultationFee === "number" ? payment.consultationFee : undefined;
  await notifyDoctorMercadoPagoPayment({
    doctorId: apt.doctor_id,
    orgId: apt.org_id,
    appointmentId,
    mercadopagoPaymentId:
      opts?.mercadopagoPaymentId ?? `confirmed-${appointmentId}`,
    patientName: patient.full_name,
    amount: fee,
    currency: (payment.currency as string | undefined) ?? "ARS",
  });

  await supabase
    .from("appointments")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("id", appointmentId);

  const { data: final } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .maybeSingle();

  return final ?? updated;
}

/** @deprecated — no longer needed, tokens come from payment_credentials table */
export function doctorMercadoPagoToken(
  _doctor: unknown,
): string | undefined {
  return undefined;
}
