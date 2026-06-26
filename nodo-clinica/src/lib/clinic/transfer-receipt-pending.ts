// @ts-nocheck
import { createServiceClient } from "@/lib/supabase/server";
import { notifyDoctorTransferPendingReview } from "@/lib/clinic/doctor-notifications";

export interface PaymentReceiptAudit {
  validatedAt: string;
  valid: boolean;
  confidence: number;
  expectedAmount?: number;
  currency?: string;
  amount?: number;
  recipient?: string;
  payerName?: string;
  transferDate?: string;
  transferTime?: string;
  operationId?: string;
  summary?: string;
  checks?: {
    amount: { pass: boolean; detail: string };
    recipient: { pass: boolean; detail: string };
    schedule: { pass: boolean; detail: string };
    receiptType: { pass: boolean; detail: string };
  };
  reasons?: string[];
}

/** Marks an appointment as pending doctor review after a payment receipt is uploaded. */
export async function markTransferReceiptPendingReview(
  appointment: { id: string; payment_status?: string; payment_provider?: string; patient_id: string; doctor_id: string; org_id: string },
  opts?: {
    audit?: PaymentReceiptAudit;
    fileName?: string;
    notifyDoctor?: boolean;
  },
): Promise<void> {
  if (
    appointment.payment_status === "confirmed" ||
    appointment.payment_status === "waived" ||
    appointment.payment_provider === "mercadopago"
  ) {
    return;
  }

  const supabase = await createServiceClient();
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

  await supabase
    .from("appointments")
    .update({
      payment_provider: appointment.payment_provider ?? "transfer",
      payment_receipt_audit: placeholderAudit,
      updated_at: now,
    })
    .eq("id", appointment.id);

  if (opts?.notifyDoctor === false) return;

  const { data: patient } = await supabase
    .from("patients")
    .select("full_name")
    .eq("id", appointment.patient_id)
    .maybeSingle();

  if (!patient) return;

  // Skip if already notified (unread transfer_pending for same appointment)
  const { data: existingNotification } = await supabase
    .from("doctor_notifications")
    .select("id")
    .eq("professional_id", appointment.doctor_id)
    .eq("type", "transfer_pending")
    .eq("read", false)
    .maybeSingle();

  // Check payload appointmentId match
  const { data: allPending } = await supabase
    .from("doctor_notifications")
    .select("id, payload")
    .eq("professional_id", appointment.doctor_id)
    .eq("type", "transfer_pending")
    .eq("read", false);

  const alreadyNotified = (allPending ?? []).some(
    (n) =>
      (n.payload as Record<string, unknown> | null)?.appointmentId === appointment.id,
  );

  if (alreadyNotified) return;

  await notifyDoctorTransferPendingReview({
    doctorId: appointment.doctor_id,
    orgId: appointment.org_id,
    appointmentId: appointment.id,
    patientName: patient.full_name,
  });
}
