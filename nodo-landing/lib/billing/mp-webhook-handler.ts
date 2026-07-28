import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthorizedPayment, getPreapproval } from "./mp-client";
import { currentCycleKey } from "./billing-time";

/**
 * Handles the two MP Preapproval webhook topics. Neither branch ever sets
 * `client_units.status = 'impago'` — that transition is the reconciliation
 * job's job (Phase 5.3, day-30 checkpoint with full MP terminal-state
 * visibility). The webhook alone only sees one event at a time and can't tell
 * a mid-retry rejection from an exhausted one, so on anything other than an
 * approved payment it just records the attempt and leaves `client_units`
 * alone (spec `platform-billing` — "Reacting to MP's Recurring Billing
 * Outcome").
 */

export interface WebhookResult {
  ok: boolean;
  subscriptionId?: string;
  skipped?: string;
}

async function recordPaymentAttempt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  subscriptionId: string,
  cycleKey: string,
  payment: {
    mpPaymentId: string | null;
    amount: number | null;
    status: "approved" | "pending" | "rejected";
  },
): Promise<void> {
  if (payment.mpPaymentId) {
    const { data: existing } = await db
      .from("subscription_payments")
      .select("id")
      .eq("subscription_id", subscriptionId)
      .eq("cycle_key", cycleKey)
      .eq("mp_payment_id", payment.mpPaymentId)
      .maybeSingle();
    if (existing) return; // Already recorded — idempotent webhook redelivery.
  }

  const { data: maxRow } = await db
    .from("subscription_payments")
    .select("attempt_no")
    .eq("subscription_id", subscriptionId)
    .eq("cycle_key", cycleKey)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  await db.from("subscription_payments").insert({
    subscription_id: subscriptionId,
    cycle_key: cycleKey,
    attempt_no: (maxRow?.attempt_no ?? 0) + 1,
    mp_payment_id: payment.mpPaymentId,
    amount: payment.amount,
    status: payment.status,
  });
}

/**
 * `subscription_authorized_payment` topic — an individual recurring-charge
 * invoice. On an approved charge: records it and advances the subscription's
 * cycle from the payment date (not the original anniversary).
 */
export async function processSubscriptionAuthorizedPayment(
  authorizedPaymentId: string,
): Promise<WebhookResult> {
  const token = process.env.LANDING_MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, skipped: "missing_token" };

  const invoice = await getAuthorizedPayment(token, authorizedPaymentId);
  if (!invoice.preapproval_id) {
    return { ok: true, skipped: "no_preapproval_id" };
  }

  const db = createAdminClient();
  const { data: sub } = await db
    .from("client_unit_subscriptions")
    .select("id")
    .eq("mp_preapproval_id", invoice.preapproval_id)
    .maybeSingle();

  if (!sub) return { ok: true, skipped: "subscription_not_matched" };

  const paymentStatus = invoice.payment?.status ?? null;
  const debitDate = invoice.debit_date
    ? new Date(invoice.debit_date)
    : invoice.date_created
      ? new Date(invoice.date_created)
      : new Date();
  const cycleKey = currentCycleKey(debitDate);
  const amount = invoice.transaction_amount != null ? Number(invoice.transaction_amount) : null;
  const mpPaymentId = invoice.payment?.id != null ? String(invoice.payment.id) : null;

  if (paymentStatus !== "approved") {
    await recordPaymentAttempt(db, sub.id, cycleKey, {
      mpPaymentId,
      amount,
      status: paymentStatus === "rejected" ? "rejected" : "pending",
    });
    return { ok: true, subscriptionId: sub.id, skipped: `payment_status:${paymentStatus ?? "unknown"}` };
  }

  await recordPaymentAttempt(db, sub.id, cycleKey, {
    mpPaymentId: mpPaymentId ?? String(authorizedPaymentId),
    amount,
    status: "approved",
  });

  const nextDueAt = new Date(debitDate);
  nextDueAt.setUTCMonth(nextDueAt.getUTCMonth() + 1);

  await db
    .from("client_unit_subscriptions")
    .update({
      status: "active",
      cycle_started_at: debitDate.toISOString(),
      next_due_at: nextDueAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  return { ok: true, subscriptionId: sub.id };
}

/**
 * `subscription_preapproval` topic — overall Preapproval status change
 * (authorized/paused/cancelled). Updates only `client_unit_subscriptions`'s
 * own tracking status, never `client_units.status`.
 */
export async function processSubscriptionPreapprovalUpdate(
  preapprovalId: string,
): Promise<WebhookResult> {
  const token = process.env.LANDING_MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, skipped: "missing_token" };

  const preapproval = await getPreapproval(token, preapprovalId);

  const db = createAdminClient();
  const { data: sub } = await db
    .from("client_unit_subscriptions")
    .select("id")
    .eq("mp_preapproval_id", preapprovalId)
    .maybeSingle();

  if (!sub) return { ok: true, skipped: "subscription_not_matched" };

  const status =
    preapproval.status === "authorized"
      ? "active"
      : preapproval.status === "cancelled"
        ? "paused"
        : "past_due";

  await db
    .from("client_unit_subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", sub.id);

  return { ok: true, subscriptionId: sub.id };
}
