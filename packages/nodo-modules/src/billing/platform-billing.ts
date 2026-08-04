import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingCycle = "monthly" | "annual";

export interface UnitPlanOption {
  code: string;
  label: string;
  priceMonthly: number;
  priceAnnualMonthly: number;
  currency: string;
  sortOrder: number;
}

export interface BillingSubscriptionRow {
  plan_code: string | null;
  plan_label: string | null;
  billing_amount: number | string | null;
  billing_currency: string | null;
  billing_cycle: string | null;
  cycle_started_at: string | null;
  next_due_at: string | null;
  subscription_status: string | null;
  client_unit_status: string | null;
}

export async function fetchUnitPlansForSubscriber(
  supabase: SupabaseClient,
  unitCode: string,
): Promise<UnitPlanOption[]> {
  const { data, error } = await supabase
    .schema("nodo_core")
    .rpc("get_unit_plans_for_subscriber", { p_unit_code: unitCode });

  if (error || !data) return [];

  return (data as Array<{
    code: string;
    label: string;
    price_monthly: number | string;
    price_annual_monthly: number | string | null;
    currency: string;
    sort_order: number;
  }>).map((row) => ({
    code: row.code,
    label: row.label,
    priceMonthly: Number(row.price_monthly),
    priceAnnualMonthly: Number(row.price_annual_monthly) || 0,
    currency: row.currency,
    sortOrder: row.sort_order,
  }));
}

export async function fetchMyBillingSubscriptionRow(
  supabase: SupabaseClient,
  unitCode: string,
): Promise<BillingSubscriptionRow | null> {
  const { data, error } = await supabase
    .schema("nodo_core")
    .rpc("get_my_client_unit_subscription", { p_unit_code: unitCode });

  if (error || !data || !(data as BillingSubscriptionRow[]).length) return null;
  return (data as BillingSubscriptionRow[])[0] ?? null;
}

export function defaultLandingBillingOrigin(): string {
  if (typeof import.meta !== "undefined") {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
    const fromEnv = env?.VITE_NODO_LANDING_URL?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location.origin.includes("localhost")) {
    return "http://localhost:3000";
  }
  return "https://nodocore.com.ar";
}

export async function startPlatformSubscriptionCheckout(params: {
  landingOrigin?: string;
  unitCode: string;
  planCode: string;
  backUrl: string;
  accessToken: string;
  billingCycle?: BillingCycle;
}): Promise<{ initPoint?: string; planChanged?: boolean; requiresPayment?: boolean }> {
  const origin = (params.landingOrigin ?? defaultLandingBillingOrigin()).replace(/\/$/, "");
  const res = await fetch(`${origin}/api/billing/subscription/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      unitCode: params.unitCode,
      planCode: params.planCode,
      backUrl: params.backUrl,
      billingCycle: params.billingCycle ?? "monthly",
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    initPoint?: string;
    planChanged?: boolean;
    requiresPayment?: boolean;
  };

  if (!res.ok) {
    throw new Error(data.error || "No se pudo iniciar el cambio de plan.");
  }

  return data;
}

export async function cancelPlatformSubscription(params: {
  landingOrigin?: string;
  unitCode: string;
  accessToken: string;
}): Promise<void> {
  const origin = (params.landingOrigin ?? defaultLandingBillingOrigin()).replace(/\/$/, "");
  const res = await fetch(`${origin}/api/billing/subscription/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({ unitCode: params.unitCode }),
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "No se pudo cancelar la suscripción.");
  }
}

export function formatUnitPlanPrice(amount: number, currency: string): string {
  if (!Number.isFinite(amount) || amount <= 0) return currency === "USD" ? "US$0" : "$0";
  const formatted = amount.toLocaleString("es-AR");
  return currency === "USD" ? `US$${formatted}` : `$${formatted}`;
}
