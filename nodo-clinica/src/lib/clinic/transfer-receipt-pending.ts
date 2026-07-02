import {
  readDb,
  writeDb,
  type LocalAppointment,
  type PaymentReceiptAudit,
} from "@/lib/clinic/local-db";
import { notifyDoctorTransferPendingReview } from "@/lib/clinic/doctor-notifications";

/** Marca el turno como pendiente de revisión médica tras subir comprobante. */
export async function markTransferReceiptPendingReview(
  appointment: LocalAppointment,
  opts?: {
    audit?: PaymentReceiptAudit;
    fileName?: string;
    notifyDoctor?: boolean;
  },
): Promise<void> {
  if (
    appointment.paymentStatus === "confirmed" ||
    appointment.paymentStatus === "waived" ||
    appointment.paymentProvider === "mercadopago"
  ) {
    return;
  }

  const now = new Date().toISOString();
  const placeholderAudit: PaymentReceiptAudit =
    opts?.audit ?? {
      validatedAt: now,
      valid: false,
      confidence: 0,
      summary: opts?.fileName
        ? `Comprobante subido: ${opts.fileName}`
        : "Comprobante subido — pendiente de revisión",
      reasons: ["Pendiente de revisión por el médico"],
    };

  await writeDb((d) => {
    const target = d.appointments.find((a) => a.id === appointment.id);
    if (!target) return;
    target.paymentProvider = target.paymentProvider ?? "transfer";
    if (!target.paymentReceiptAudit || opts?.audit) {
      target.paymentReceiptAudit = placeholderAudit;
    }
    target.updatedAt = now;
  });

  if (opts?.notifyDoctor === false) return;

  const db = await readDb();
  const patient = db.patients.find((p) => p.id === appointment.patientId);
  const doctor = db.doctors.find((d) => d.id === appointment.doctorId);
  if (!patient || !doctor) return;

  const alreadyNotified = (db.doctorNotifications ?? []).some(
    (n) =>
      n.doctorId === doctor.id &&
      n.type === "transfer_pending" &&
      n.meta?.appointmentId === appointment.id &&
      !n.read,
  );
  if (alreadyNotified) return;

  await notifyDoctorTransferPendingReview({
    doctorId: doctor.id,
    appointmentId: appointment.id,
    patientName: patient.fullName,
  });
}
