import { createServiceClient } from "@/lib/supabase/server";
import { getPreapproval } from "@/lib/mercadopago/client";

/**
 * Processes a Preapproval (Nodo subscription) webhook notification.
 * Always uses Nodo's own MERCADOPAGO_ACCESS_TOKEN — this is Nodo billing the
 * doctor, unrelated to any doctor's own OAuth-connected account.
 */
export async function processMercadoPagoPreapprovalId(
  preapprovalId: string,
): Promise<{ ok: boolean; professionalId?: string; skipped?: string }> {
  const nodoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!nodoAccessToken) {
    return { ok: false, skipped: "missing_nodo_access_token" };
  }

  const preapproval = await getPreapproval(nodoAccessToken, preapprovalId);

  const supabase = await createServiceClient();
  const { data: professional } = await supabase
    .from("professionals")
    .select("id")
    .eq("mercadopago_preapproval_id", preapprovalId)
    .maybeSingle();

  if (professional) {
    const subscriptionStatus =
      preapproval.status === "authorized" ? "active" : "expired";

    await supabase
      .from("professionals")
      .update({
        subscription_status: subscriptionStatus,
        subscription_next_payment_at: preapproval.next_payment_date ?? null,
      })
      .eq("id", professional.id);

    return { ok: true, professionalId: professional.id };
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("mercadopago_preapproval_id", preapprovalId)
    .maybeSingle();

  if (!patient) {
    return { ok: true, skipped: "account_not_matched" };
  }

  const patientPlan =
    preapproval.status === "authorized" ? "pago" : "gratuito";

  await supabase
    .from("patients")
    .update({ subscription_plan: patientPlan })
    .eq("id", patient.id);

  return { ok: true, patientId: patient.id };
}
