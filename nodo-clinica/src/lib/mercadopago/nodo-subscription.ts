import "server-only";
import { createPreapproval } from "@/lib/mercadopago/client";
import { resolveFxRate } from "@/lib/mercadopago/fx-rate";
import { createNodoCoreServiceClient } from "@/lib/supabase/server";
import type { SubscriptionPlan } from "@/lib/clinic/subscription-plans";

export type NodoSubscriptionCheckoutResult =
  | { ok: true; preapprovalId: string; initPoint: string }
  | { ok: false; error: string; status: number };

export type BillingCycle = "monthly" | "annual";

/** Maps the onboarding/checkout plan id space to nodo_core.planes codes (unit_code "Clínica"). */
const PLAN_DB_CODES: Record<string, string> = {
  demo: "medico_demo",
  profesional: "medico_pro",
};

/**
 * Starts a doctor's monthly or annual Nodo platform subscription
 * (MercadoPago Preapproval) — Nodo billing the doctor, always using Nodo's
 * own MERCADOPAGO_ACCESS_TOKEN, never the doctor's connected OAuth token.
 *
 * The price charged is ALWAYS read live from nodo_core.planes (the same
 * catalog editable from the nodo-landing admin panel at
 * /panel/unidades/clinica) — never the static SubscriptionPlan.amount,
 * which is display-only fallback pricing shown before that live pricing
 * loads. Confirmed with the user: editing a plan's price there must be
 * what actually gets charged.
 *
 * MercadoPago Argentina rejects auto_recurring.currency_id = "USD" ("Invalid
 * field") — Preapproval subscriptions must be billed in ARS even though
 * nodo_core.planes prices this plan in USD. Convert at dólar oficial rate.
 *
 * "annual" charges once a year (frequency: 12 months) at
 * planes.price_annual_monthly — despite the column name, that value is
 * already the TOTAL annual amount (price_monthly × 10, "10 months paid for
 * 12"), not a monthly-equivalent rate. Do not multiply by 12.
 */
export async function createNodoSubscriptionPreapproval(params: {
  plan: SubscriptionPlan;
  payerEmail: string;
  externalReference: string;
  backUrl: string;
  billingCycle?: BillingCycle;
}): Promise<NodoSubscriptionCheckoutResult> {
  const nodoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!nodoAccessToken) {
    return {
      ok: false,
      error: "Falta configurar MERCADOPAGO_ACCESS_TOKEN (cuenta de Nodo) en el servidor.",
      status: 503,
    };
  }

  const billingCycle: BillingCycle = params.billingCycle ?? "monthly";

  const dbCode = PLAN_DB_CODES[params.plan.id];
  if (!dbCode) {
    return {
      ok: false,
      error: `Plan '${params.plan.id}' no está mapeado a nodo_core.planes.`,
      status: 503,
    };
  }

  const db = await createNodoCoreServiceClient();
  const { data: planRow, error: planError } = await db
    .from("planes")
    .select("price_monthly, price_annual_monthly, currency")
    .eq("unit_code", "Clínica")
    .eq("code", dbCode)
    .eq("is_active", true)
    .maybeSingle();

  if (planError || !planRow) {
    return {
      ok: false,
      error: `No se encontró un plan activo '${dbCode}' en nodo_core.planes.`,
      status: 503,
    };
  }

  const currency = (planRow.currency as string) ?? params.plan.currency;
  let sourceAmount: number;

  if (billingCycle === "annual") {
    const annualTotal = Number(planRow.price_annual_monthly);
    if (!Number.isFinite(annualTotal) || annualTotal <= 0) {
      return {
        ok: false,
        error: `Plan '${dbCode}' no tiene precio anual configurado.`,
        status: 503,
      };
    }
    sourceAmount = annualTotal;
  } else {
    const monthly = Number(planRow.price_monthly);
    if (!Number.isFinite(monthly) || monthly <= 0) {
      return {
        ok: false,
        error: `Plan '${dbCode}' no tiene precio mensual configurado.`,
        status: 503,
      };
    }
    sourceAmount = monthly;
  }

  let billingAmount = sourceAmount;
  if (currency === "USD") {
    const fx = await resolveFxRate();
    if (!fx.ok) {
      return {
        ok: false,
        error: "No se pudo obtener la cotización del dólar para procesar el cobro. Reintentá en unos minutos.",
        status: 503,
      };
    }
    billingAmount = Math.round(sourceAmount * fx.rate * 100) / 100;
  }
  const billingCurrency = currency === "USD" ? "ARS" : currency;
  const frequency = billingCycle === "annual" ? 12 : 1;

  try {
    const preapproval = await createPreapproval({
      accessToken: nodoAccessToken,
      reason: `Suscripción ${params.plan.name} — Nodo Clínica (${billingCycle === "annual" ? "anual" : "mensual"})`,
      payerEmail: params.payerEmail,
      externalReference: params.externalReference,
      amount: billingAmount,
      currency: billingCurrency,
      backUrl: params.backUrl,
      frequency,
    });
    if (!preapproval.initPoint) {
      return {
        ok: false,
        error: "Mercado Pago no devolvió un link de pago.",
        status: 502,
      };
    }
    return { ok: true, preapprovalId: preapproval.id, initPoint: preapproval.initPoint };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al iniciar la suscripción con Mercado Pago",
      status: 502,
    };
  }
}
