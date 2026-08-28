import { createServiceClient } from "@/lib/supabase/server";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { isMailConfigured } from "@/lib/mail";
import { sendPrescriptionReadyEmail } from "@/lib/email/resend";

/**
 * Fase 4 of "Recetas" — mirrors confirmAppointmentPaymentAndNotify, but for a
 * standalone receta paid via MP Checkout. Unlike the turno flow, there's no
 * doctor-facing notification here (Fase 5 covers the médico's recetas
 * history) — just marking the payment confirmed and letting the patient
 * know their receta is ready.
 */
export async function confirmPrescriptionPaymentAndNotify(
  prescriptionId: string,
  opts: { mercadopagoPaymentId: string },
): Promise<Record<string, unknown> | null> {
  // The Fase 2 `prescriptions` columns (payment_status, access_token, etc)
  // predate the generated Database type — same untyped-cast pattern already
  // used for this table elsewhere in Fase 2/3/4.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServiceClient()) as any;

  const { data: prescription, error: fetchError } = await supabase
    .from("prescriptions")
    .select("id, doctor_id, access_token, patient_email, patient_full_name, payment_status")
    .eq("id", prescriptionId)
    .maybeSingle();

  if (fetchError || !prescription) return null;

  if (
    prescription.payment_status === "confirmed" ||
    prescription.payment_status === "waived"
  ) {
    return prescription;
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("prescriptions")
    .update({
      payment_status: "confirmed",
      payment_confirmed_at: now,
      mercadopago_payment_id: opts.mercadopagoPaymentId,
    })
    .eq("id", prescriptionId)
    .select()
    .single();

  if (updateError || !updated) return null;

  if (prescription.patient_email) {
    const { data: professional } = await supabase
      .from("professionals")
      .select("full_name")
      .eq("id", prescription.doctor_id)
      .maybeSingle();

    const recetaUrl = `${appBaseUrl()}/paciente/receta/${prescription.access_token}`;

    if (isMailConfigured()) {
      sendPrescriptionReadyEmail({
        patientEmail: prescription.patient_email,
        patientName: prescription.patient_full_name ?? "Paciente",
        doctorName: professional?.full_name ?? "tu médico",
        recetaUrl,
      }).catch((err) =>
        console.error("[prescription-payment] confirmation email error", err),
      );
    } else {
      console.warn(
        "[prescription-payment] SMTP not configured — receta lista (dev only):",
        recetaUrl,
      );
    }
  }

  return updated;
}
