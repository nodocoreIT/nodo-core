import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * This unit's own platform-subscription billing state (NODO billing the
 * clinic, unrelated to the doctor's own MercadoPago subscription in
 * lib/mercadopago/ and professionals.subscription_status), read via the
 * `nodo_core.get_my_client_unit_subscription` RPC (SECURITY DEFINER —
 * returns rows only for the client_unit matching the signed-in user).
 * See nodo-landing/supabase/migrations/20260728000000_get_my_client_unit_subscription_rpc.sql.
 */
export interface BillingSubscriptionInfo {
  planLabel: string;
  billingAmount: number;
  billingCurrency: string;
  cycleStartedAt: string;
  nextDueAt: string;
  subscriptionStatus: string;
  clientUnitStatus: string;
}

interface BillingSubscriptionRow {
  plan_label: string;
  billing_amount: number | string;
  billing_currency: string;
  cycle_started_at: string;
  next_due_at: string;
  subscription_status: string;
  client_unit_status: string;
}

export function useBillingSubscription(): {
  subscription: BillingSubscriptionInfo | null;
  isLoading: boolean;
} {
  const [subscription, setSubscription] = useState<BillingSubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getSupabaseBrowserClient()
      .schema("nodo_core")
      .rpc("get_my_client_unit_subscription", { p_unit_code: "Clínica" })
      .then(({ data, error }) => {
        if (cancelled) return;
        const rows = (data ?? []) as BillingSubscriptionRow[];
        if (error || rows.length === 0) {
          setSubscription(null);
        } else {
          const row = rows[0];
          setSubscription({
            planLabel: row.plan_label,
            billingAmount: Number(row.billing_amount),
            billingCurrency: row.billing_currency,
            cycleStartedAt: row.cycle_started_at,
            nextDueAt: row.next_due_at,
            subscriptionStatus: row.subscription_status,
            clientUnitStatus: row.client_unit_status,
          });
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { subscription, isLoading };
}
