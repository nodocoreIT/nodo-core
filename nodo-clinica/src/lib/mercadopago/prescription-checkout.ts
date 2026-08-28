import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { getDoctorMercadoPagoAccessToken } from "@/lib/mercadopago/tokens";
import { createServiceClient } from "@/lib/supabase/server";
import { checkoutUrl, createCheckoutPreference } from "@/lib/mercadopago/client";

function buildBackUrls(base: string, accessToken: string) {
  const path = `/paciente/receta/${accessToken}`;
  return {
    success: `${base}${path}?mp=success`,
    failure: `${base}${path}?mp=failure`,
    pending: `${base}${path}?mp=pending`,
  };
}

export interface PrescriptionCheckoutOptions {
  /** Kept for symmetry with buildCheckoutForAppointment's CheckoutOptions —
   * recetas only ever return to the magic-link landing, so this isn't used
   * to branch back_urls yet, but callers may still pass it. */
  returnTo?: string;
}

/**
 * Fase 4 of "Recetas" — mirrors buildCheckoutForAppointment (checkout.ts),
 * but for a standalone receta instead of a turno. No local-mode variant:
 * standalone recetas were introduced after local-mode was frozen to
 * appointments/turnos only, so this always talks to Supabase.
 */
export async function buildCheckoutForPrescription(
  prescriptionId: string,
  options: PrescriptionCheckoutOptions = {},
) {
  void options;
  // The Fase 2 `prescriptions` columns (price_amount, access_token, etc)
  // predate the generated Database type — same untyped-cast pattern already
  // used for this table elsewhere in Fase 2/3.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServiceClient()) as any;

  const { data: prescription } = await supabase
    .from("prescriptions")
    .select(
      "id, doctor_id, access_token, price_amount, price_currency, patient_email, patient_full_name",
    )
    .eq("id", prescriptionId)
    .maybeSingle();

  if (!prescription) return null;
  if (!prescription.access_token) return null;
  if (!prescription.patient_email) return null;

  const amount =
    typeof prescription.price_amount === "number" ? prescription.price_amount : 0;
  if (amount <= 0) return null;

  const { data: professional } = await supabase
    .from("professionals")
    .select("full_name")
    .eq("id", prescription.doctor_id)
    .maybeSingle();

  if (!professional) return null;

  const token = await getDoctorMercadoPagoAccessToken(prescription.doctor_id);
  if (!token) return null;

  const base = appBaseUrl();

  const pref = await createCheckoutPreference({
    accessToken: token,
    title: "Emisión de receta médica",
    amount,
    currency: prescription.price_currency ?? "ARS",
    // Prefixed so the shared webhook handler can dispatch to `prescriptions`
    // instead of `appointments` without ambiguity (see
    // handle-payment-webhook.ts).
    externalReference: `receta:${prescription.id}`,
    payerEmail: prescription.patient_email,
    notificationUrl: `${base}/api/webhooks/mercadopago`,
    backUrls: buildBackUrls(base, prescription.access_token),
  });

  await supabase
    .from("prescriptions")
    .update({
      mercadopago_preference_id: pref.id,
    })
    .eq("id", prescription.id);

  return {
    checkoutUrl: checkoutUrl(pref, token),
    preferenceId: pref.id,
  };
}
