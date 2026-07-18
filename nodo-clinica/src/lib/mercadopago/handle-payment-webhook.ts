import { createServiceClient } from "@/lib/supabase/server";
import { confirmAppointmentPaymentAndNotify } from "@/lib/clinic/appointment-payment";
import { getPayment, type MpPaymentInfo } from "@/lib/mercadopago/client";
import { getDoctorMercadoPagoAccessToken } from "@/lib/mercadopago/tokens";

export async function processMercadoPagoPaymentId(
  paymentId: string,
): Promise<{ ok: boolean; appointmentId?: string; skipped?: string }> {
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

    const appointmentId = payment.external_reference;
    if (!appointmentId) {
      return { ok: true, skipped: "no_external_reference" };
    }

    const { data: apt } = await supabase
      .from("appointments")
      .select("id, doctor_id, org_id")
      .eq("id", appointmentId)
      .eq("doctor_id", s.professional_id)
      .maybeSingle();

    if (!apt) continue;

    await confirmAppointmentPaymentAndNotify(appointmentId, {
      mercadopagoPaymentId: String(payment.id),
    });

    return { ok: true, appointmentId };
  }

  return { ok: true, skipped: "payment_not_matched" };
}
