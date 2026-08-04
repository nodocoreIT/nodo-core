import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveFxRate } from "./fx-rate";
import { billingDayFrom, currentCycleKey } from "./billing-time";

/**
 * Creates/refreshes NODO's own MercadoPago Preapproval (recurring subscription
 * charge) per client_unit — mirrors nodo-clinica's `createPreapproval` request
 * shape (lib/mercadopago/client.ts), but this is a separate MP account/credential
 * (LANDING_MERCADOPAGO_ACCESS_TOKEN): nodo-clinica bills doctors for their own
 * Nodo Clínica subscription, this bills client_units for their platform
 * subscription — two distinct revenue streams, never mix the tokens.
 */

const MP_API = "https://api.mercadopago.com";

export type CreatePreapprovalFailureReason =
  | "missing_token"
  | "unit_not_found"
  | "unit_not_enabled"
  | "plan_not_found"
  | "payer_email_missing"
  | "fx_unavailable"
  | "annual_price_not_configured"
  | "mp_rejected";

export type BillingCycle = "monthly" | "annual";

export interface CreatePreapprovalSuccess {
  ok: true;
  subscriptionId: string;
  preapprovalId: string;
  /** MP checkout URL — the client_unit's contact must open this to authorize the charge. */
  initPoint?: string;
  billingAmount: number;
  billingCurrency: "ARS";
  billingCycle: BillingCycle;
  billingDay: number;
}

export interface CreatePreapprovalFailure {
  ok: false;
  reason: CreatePreapprovalFailureReason;
  detail: string;
}

export type CreatePreapprovalResult =
  | CreatePreapprovalSuccess
  | CreatePreapprovalFailure;

interface ClientUnitRow {
  id: string;
  client_id: string;
  unit_code: string;
  plan: string | null;
  enabled_at: string | null;
  access_user: string | null;
}

interface PlanRow {
  id: string;
  price_monthly: number | string;
  price_annual_monthly: number | string | null;
  label: string;
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://nodocore.com").replace(
    /\/$/,
    "",
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Creates exactly one active MP Preapproval for `clientUnitId` (idempotent —
 * upserts `client_unit_subscriptions` keyed on the unique `client_unit_id`).
 * Resolves price via `nodo_core.planes` (USD) × `resolveFxRate()` (ARS debit
 * amount). Never charges $0: if the FX rate can't be resolved, this returns
 * `{ reason: "fx_unavailable" }` without calling MP at all, and — if a
 * subscription row already exists for this unit — records the failed attempt
 * in `subscription_payments`.
 */
export async function createPreapproval(
  clientUnitId: string,
  options: { backUrl?: string; billingCycle?: BillingCycle } = {},
): Promise<CreatePreapprovalResult> {
  const billingCycle: BillingCycle = options.billingCycle ?? "monthly";
  const accessToken = process.env.LANDING_MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return {
      ok: false,
      reason: "missing_token",
      detail:
        "Falta configurar LANDING_MERCADOPAGO_ACCESS_TOKEN (cuenta MP de facturación de plataforma) en el servidor.",
    };
  }

  const db = createAdminClient();

  const { data: unitRow, error: unitError } = await db
    .from("client_units")
    .select("id, client_id, unit_code, plan, enabled_at, access_user")
    .eq("id", clientUnitId)
    .maybeSingle();

  if (unitError || !unitRow) {
    return {
      ok: false,
      reason: "unit_not_found",
      detail: `client_unit ${clientUnitId} not found.`,
    };
  }
  const unit = unitRow as ClientUnitRow;

  if (!unit.enabled_at) {
    return {
      ok: false,
      reason: "unit_not_enabled",
      detail: "client_unit has no enabled_at yet — cannot anchor billing_day.",
    };
  }

  if (!unit.plan) {
    return {
      ok: false,
      reason: "plan_not_found",
      detail: "client_unit has no plan assigned.",
    };
  }

  const { data: planRowData, error: planError } = await db
    .from("planes")
    .select("id, price_monthly, price_annual_monthly, label")
    .eq("unit_code", unit.unit_code)
    .eq("code", unit.plan)
    .eq("is_active", true)
    .maybeSingle();

  if (planError || !planRowData) {
    return {
      ok: false,
      reason: "plan_not_found",
      detail: `No active plan '${unit.plan}' for unit_code '${unit.unit_code}'.`,
    };
  }
  const plan = planRowData as PlanRow;

  let payerEmail = unit.access_user;
  if (!payerEmail) {
    const { data: clientRow } = await db
      .from("clients")
      .select("email")
      .eq("id", unit.client_id)
      .maybeSingle();
    payerEmail = (clientRow as { email: string | null } | null)?.email ?? null;
  }
  if (!payerEmail) {
    return {
      ok: false,
      reason: "payer_email_missing",
      detail: "No access_user on the client_unit and no email on its parent client.",
    };
  }

  const { data: existingSubData } = await db
    .from("client_unit_subscriptions")
    .select("id")
    .eq("client_unit_id", clientUnitId)
    .maybeSingle();
  const existingSubscription = existingSubData as { id: string } | null;

  const now = new Date();
  const fx = await resolveFxRate(now);
  if (!fx.ok) {
    if (existingSubscription) {
      await db.from("subscription_payments").insert({
        subscription_id: existingSubscription.id,
        cycle_key: currentCycleKey(now),
        status: "rejected",
        failure_reason: "fx_unavailable",
      });
    }
    return { ok: false, reason: "fx_unavailable", detail: fx.detail };
  }

  let billingAmount: number;
  if (billingCycle === "annual") {
    // Despite its name, nodo_core.planes.price_annual_monthly stores the
    // TOTAL annual amount (price_monthly × 10 — "10 months paid for 12"),
    // not a monthly-equivalent rate. Confirmed against live data (e.g.
    // medico_pro: price_monthly=1, price_annual_monthly=10 — not 0.83).
    // Do NOT multiply by 12 here.
    const annualTotal = Number(plan.price_annual_monthly);
    if (!Number.isFinite(annualTotal) || annualTotal <= 0) {
      return {
        ok: false,
        reason: "annual_price_not_configured",
        detail: `Plan '${plan.label}' no tiene price_annual_monthly configurado.`,
      };
    }
    billingAmount = round2(annualTotal * fx.rate);
  } else {
    billingAmount = round2(Number(plan.price_monthly) * fx.rate);
  }

  const billingDay = billingDayFrom(new Date(unit.enabled_at));
  const backUrl = options.backUrl ?? `${appBaseUrl()}/panel/facturacion`;
  const frequency = billingCycle === "annual" ? 12 : 1;

  const mpBody = {
    reason: `Suscripción NODO — ${plan.label} (${billingCycle === "annual" ? "anual" : "mensual"})`.slice(0, 256),
    payer_email: payerEmail,
    external_reference: clientUnitId,
    back_url: backUrl,
    auto_recurring: {
      frequency,
      frequency_type: "months",
      transaction_amount: billingAmount,
      currency_id: "ARS",
      billing_day: billingDay,
      billing_day_proportional: false,
    },
    status: "pending",
  };

  let mpData: {
    id?: string;
    init_point?: string;
    message?: string;
    error?: string;
  };
  try {
    const res = await fetch(`${MP_API}/preapproval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpBody),
    });
    mpData = await res.json();
    if (!res.ok || !mpData.id) {
      return {
        ok: false,
        reason: "mp_rejected",
        detail:
          mpData.message ??
          mpData.error ??
          `MercadoPago respondió HTTP ${res.status} al crear el Preapproval.`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      reason: "mp_rejected",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const nextDueAt = new Date(now);
  nextDueAt.setUTCMonth(nextDueAt.getUTCMonth() + frequency);

  const { data: savedSubData, error: saveError } = await db
    .from("client_unit_subscriptions")
    .upsert(
      {
        client_unit_id: clientUnitId,
        plane_id: plan.id,
        mp_preapproval_id: mpData.id,
        billing_currency: "ARS",
        billing_amount: billingAmount,
        billing_cycle: billingCycle,
        cycle_started_at: now.toISOString(),
        next_due_at: nextDueAt.toISOString(),
        status: "active",
        updated_at: now.toISOString(),
      },
      { onConflict: "client_unit_id" },
    )
    .select("id")
    .single();

  if (saveError || !savedSubData) {
    return {
      ok: false,
      reason: "mp_rejected",
      detail: `Preapproval creado en MP (${mpData.id}) pero falló al guardarse localmente: ${saveError?.message}`,
    };
  }

  return {
    ok: true,
    subscriptionId: (savedSubData as { id: string }).id,
    preapprovalId: mpData.id,
    initPoint: mpData.init_point,
    billingAmount,
    billingCurrency: "ARS",
    billingCycle,
    billingDay,
  };
}
