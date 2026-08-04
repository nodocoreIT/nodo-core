import "server-only";
import { createPreapproval } from "@/lib/mercadopago/client";
import { resolveFxRate } from "@/lib/mercadopago/fx-rate";
import type { SubscriptionPlan } from "@/lib/clinic/subscription-plans";

export type NodoSubscriptionCheckoutResult =
  | { ok: true; preapprovalId: string; initPoint: string }
  | { ok: false; error: string; status: number };

/**
 * Starts a doctor's monthly Nodo platform subscription (MercadoPago
 * Preapproval) — Nodo billing the doctor, always using Nodo's own
 * MERCADOPAGO_ACCESS_TOKEN, never the doctor's connected OAuth token.
 *
 * MercadoPago Argentina rejects auto_recurring.currency_id = "USD" ("Invalid
 * field") — Preapproval subscriptions must be billed in ARS even though
 * nodo_core.planes prices this plan in USD. Convert at dólar oficial rate,
 * mirroring nodo-landing/lib/billing/mp-preapproval.ts.
 */
export async function createNodoSubscriptionPreapproval(params: {
  plan: SubscriptionPlan;
  payerEmail: string;
  externalReference: string;
  backUrl: string;
}): Promise<NodoSubscriptionCheckoutResult> {
  const nodoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!nodoAccessToken) {
    return {
      ok: false,
      error: "Falta configurar MERCADOPAGO_ACCESS_TOKEN (cuenta de Nodo) en el servidor.",
      status: 503,
    };
  }

  let billingAmount = params.plan.amount;
  if (params.plan.currency === "USD") {
    const fx = await resolveFxRate();
    if (!fx.ok) {
      return {
        ok: false,
        error: "No se pudo obtener la cotización del dólar para procesar el cobro. Reintentá en unos minutos.",
        status: 503,
      };
    }
    billingAmount = Math.round(params.plan.amount * fx.rate * 100) / 100;
  }
  const billingCurrency = params.plan.currency === "USD" ? "ARS" : params.plan.currency;

  try {
    const preapproval = await createPreapproval({
      accessToken: nodoAccessToken,
      reason: `Suscripción ${params.plan.name} — Nodo Clínica`,
      payerEmail: params.payerEmail,
      externalReference: params.externalReference,
      amount: billingAmount,
      currency: billingCurrency,
      backUrl: params.backUrl,
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
