import { readDb, writeDb } from "@/lib/clinic/local-db";
import type { LocalAppointment, LocalDoctor } from "@/lib/clinic/local-db";
import { notifyDoctorMercadoPagoPayment } from "@/lib/clinic/doctor-notifications";
import { resolveMercadoPagoAccessToken } from "@/lib/clinic/payment";
import { sendAppointmentConfirmationEmail } from "@/lib/email/resend";
import { formatReminderLabel } from "@/lib/email/reminder-label";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function appBaseUrl() {
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3002")
  );
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "";
  if (basePath && !origin.endsWith(basePath)) {
    return `${origin}${basePath}`;
  }
  return origin;
}

export async function confirmAppointmentPaymentAndNotify(
  appointmentId: string,
  opts?: { mercadopagoPaymentId?: string }
): Promise<LocalAppointment | null> {
  const db = await readDb();
  const apt = db.appointments.find((a) => a.id === appointmentId);
  if (!apt) return null;

  if (apt.paymentStatus === "confirmed" || apt.paymentStatus === "waived") {
    return apt;
  }

  const now = new Date().toISOString();
  const wasPending = apt.paymentStatus === "pending";

  await writeDb((d) => {
    const target = d.appointments.find((a) => a.id === appointmentId);
    if (!target) return;
    target.paymentStatus = "confirmed";
    target.paymentConfirmedAt = now;
    target.updatedAt = now;
    if (target.status === "scheduled") {
      target.status = "waiting";
    }
    if (opts?.mercadopagoPaymentId) {
      target.mercadopagoPaymentId = opts.mercadopagoPaymentId;
    }
  });

  const updated = (await readDb()).appointments.find((a) => a.id === appointmentId);
  if (!updated || !wasPending) return updated ?? null;

  const patient = db.patients.find((p) => p.id === apt.patientId);
  const doctor = db.doctors.find((d) => d.id === apt.doctorId);
  if (!patient || !doctor) return updated;

  const scheduledLabel = format(
    new Date(apt.scheduledAt),
    "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
    { locale: es }
  );

  let reminderNote: string | undefined;
  if (doctor.reminderSettings?.enabled) {
    reminderNote = `Te enviaremos un recordatorio ${formatReminderLabel(
      doctor.reminderSettings.minutesBefore ?? 1440
    )} del turno a ${patient.email}.`;
  }

  sendAppointmentConfirmationEmail({
    patientEmail: patient.email,
    patientName: patient.fullName,
    doctorName: doctor.fullName,
    scheduledAt: scheduledLabel,
    waitingRoomUrl: `${appBaseUrl()}/paciente/sala/${apt.accessToken}`,
    reminderNote,
  }).catch((err) => console.error("[Email] confirmation after MP payment", err));

  const fee = doctor.payment?.consultationFee;
  await notifyDoctorMercadoPagoPayment({
    doctorId: doctor.id,
    appointmentId,
    mercadopagoPaymentId:
      opts?.mercadopagoPaymentId ?? `confirmed-${appointmentId}`,
    patientName: patient.fullName,
    amount: fee,
    currency: doctor.payment?.currency ?? "ARS",
  });

  await writeDb((d) => {
    const target = d.appointments.find((a) => a.id === appointmentId);
    if (target) target.confirmationEmailSentAt = new Date().toISOString();
  });

  return (await readDb()).appointments.find((a) => a.id === appointmentId) ?? updated;
}

export function doctorMercadoPagoToken(doctor: LocalDoctor): string | undefined {
  return resolveMercadoPagoAccessToken(doctor);
}
