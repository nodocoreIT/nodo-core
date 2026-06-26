// @ts-nocheck
import { createServiceClient } from "@/lib/supabase/server";
import { confirmAppointmentPaymentAndNotify } from "@/lib/clinic/appointment-payment";
import { getPayment, type MpPaymentInfo } from "@/lib/mercadopago/client";
import { getOrgMercadoPagoAccessToken } from "@/lib/clinic/db/payments";

export async function processMercadoPagoPaymentId(
  paymentId: string,
): Promise<{ ok: boolean; appointmentId?: string; skipped?: string }> {
  const supabase = await createServiceClient();

  // Get all orgs that have payment credentials
  const { data: orgs } = await supabase
    .from("office_settings")
    .select("org_id");

  for (const org of orgs ?? []) {
    const token = await getOrgMercadoPagoAccessToken(org.org_id);
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
      .eq("org_id", org.org_id)
      .maybeSingle();

    if (!apt) continue;

    await confirmAppointmentPaymentAndNotify(appointmentId, {
      mercadopagoPaymentId: String(payment.id),
    });

    return { ok: true, appointmentId };
  }

  return { ok: true, skipped: "payment_not_matched" };
}
