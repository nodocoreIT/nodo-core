import { createServiceClient } from "@/lib/supabase/server";
import { confirmAppointmentPaymentAndNotify } from "@/lib/clinic/appointment-payment";
import { confirmPrescriptionPaymentAndNotify } from "@/lib/clinic/prescription-payment";
import { getPayment, type MpPaymentInfo } from "@/lib/mercadopago/client";
import { getDoctorMercadoPagoAccessToken } from "@/lib/mercadopago/tokens";

const PRESCRIPTION_REFERENCE_PREFIX = "receta:";

export async function processMercadoPagoPaymentId(
  paymentId: string,
): Promise<{ ok: boolean; appointmentId?: string; prescriptionId?: string; skipped?: string }> {
  const supabase = await createServiceClient();

  // Get all professionals that have office_settings (each doctor's own MP token)
  const { data: settings } = await supabase
    .from("office_settings")
    .select("professional_id");

  for (const s of settings ?? []) {
    const token = await getDoctorMercadoPagoAccessToken(s.professional_id);
    if (!token) continue;

    let payment: MpPaymentInfo;
    try {
      payment = await getPayment(token, paymentId);
    } catch {
      continue;
    }

    if (payment.status !== "approved") {
      return { ok: true, skipped: `status:${payment.status}` };
    }

    const externalReference = payment.external_reference;
    if (!externalReference) {
      return { ok: true, skipped: "no_external_reference" };
    }

    // Fase 4 of "Recetas" — standalone prescriptions use a `receta:` prefixed
    // external_reference (see buildCheckoutForPrescription) precisely so
    // this shared webhook can dispatch to `prescriptions` instead of
    // `appointments` without ambiguity.
    if (externalReference.startsWith(PRESCRIPTION_REFERENCE_PREFIX)) {
      const prescriptionId = externalReference.slice(PRESCRIPTION_REFERENCE_PREFIX.length);

      const professionalId = (s as { professional_id: string }).professional_id;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prescription } = await (supabase as any)
        .from("prescriptions")
        .select("id, doctor_id")
        .eq("id", prescriptionId)
        .eq("doctor_id", professionalId)
        .maybeSingle();

      if (!prescription) continue;

      await confirmPrescriptionPaymentAndNotify(prescriptionId, {
        mercadopagoPaymentId: String(payment.id),
      });

      return { ok: true, prescriptionId };
    }

    const appointmentId = externalReference;

    const { data: apt } = await supabase
      .from("appointments")
      .select("id, doctor_id, org_id")
      .eq("id", appointmentId)
      .eq("doctor_id", s.professional_id)
      .maybeSingle();

    if (!apt) continue;

    await confirmAppointmentPaymentAndNotify(appointmentId, {
      mercadopagoPaymentId: String(payment.id),
      amount: payment.transaction_amount,
      currency: payment.currency_id,
    });

    return { ok: true, appointmentId };
  }

  return { ok: true, skipped: "payment_not_matched" };
}
