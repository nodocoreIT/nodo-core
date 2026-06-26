// @ts-nocheck
import { createServiceClient } from "@/lib/supabase/server";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { getOrgMercadoPagoAccessToken } from "@/lib/clinic/db/payments";
import {
  checkoutUrl,
  createCheckoutPreference,
} from "@/lib/mercadopago/client";

export async function buildCheckoutForAppointment(appointmentId: string) {
  const supabase = await createServiceClient();

  const { data: apt } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!apt) return null;

  const { data: patient } = await supabase
    .from("patients")
    .select("email, full_name")
    .eq("id", apt.patient_id)
    .maybeSingle();

  const { data: officeSettings } = await supabase
    .from("office_settings")
    .select("payment")
    .eq("org_id", apt.org_id)
    .maybeSingle();

  const { data: professional } = await supabase
    .from("professionals")
    .select("full_name")
    .eq("id", apt.doctor_id)
    .maybeSingle();

  if (!patient || !professional) return null;

  const payment = (officeSettings?.payment as Record<string, unknown>) ?? {};
  const fee = typeof payment.consultationFee === "number" ? payment.consultationFee : 0;
  const currency = (payment.currency as string | undefined) ?? "ARS";
  const mercadopagoEnabled = !!payment.mercadopagoEnabled;

  if (!mercadopagoEnabled || fee <= 0) return null;

  const token = await getOrgMercadoPagoAccessToken(apt.org_id);
  if (!token) return null;

  const base = appBaseUrl();
  const waitingPath = `/paciente/sala/${apt.access_token}`;

  const pref = await createCheckoutPreference({
    accessToken: token,
    title: `Consulta — Dr/a. ${professional.full_name}`,
    amount: fee,
    currency,
    externalReference: apt.id,
    payerEmail: patient.email,
    notificationUrl: `${base}/api/webhooks/mercadopago`,
    backUrls: {
      success: `${base}${waitingPath}?mp=success`,
      failure: `${base}${waitingPath}?mp=failure`,
      pending: `${base}${waitingPath}?mp=pending`,
    },
  });

  await supabase
    .from("appointments")
    .update({
      mercadopago_preference_id: pref.id,
      payment_provider: "mercadopago",
      updated_at: new Date().toISOString(),
    })
    .eq("id", apt.id);

  return {
    checkoutUrl: checkoutUrl(pref, token),
    preferenceId: pref.id,
  };
}
