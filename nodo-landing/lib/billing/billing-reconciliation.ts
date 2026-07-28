import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPreapproval } from "./mp-client";
import { currentCycleKey } from "./billing-time";
import { sendPaymentOverdueEmail } from "@/lib/mail";

/**
 * Daily safety-net poll (design.md — "Reactive: webhook-first + daily poll
 * safety-net"). The webhook is the source of truth; this job only catches
 * subscriptions whose cycle is well past due AND have no approved payment on
 * record, confirms MP's own terminal state, and flips `client_units.status`
 * to `impago` — the ONE place in this change that makes that transition.
 * Never initiates a charge.
 *
 * Idempotency note on "for update skip locked": PostgREST (the Supabase JS
 * client's transport) doesn't expose row-level locking directly. Instead,
 * each flip is a single atomic conditional UPDATE
 * (`WHERE id = X AND status != 'impago'`), which Postgres already row-locks
 * for the duration of that statement — so two overlapping runs can't both
 * "win" the same row, and a re-run against an already-`impago` unit is a
 * no-op (zero rows returned, no duplicate email). This gives the same
 * duplicate-write/duplicate-email safety the task asks for without a
 * dedicated locking migration for a job that ships feature-flagged off.
 */

const GRACE_DAYS = Number(process.env.BILLING_RECONCILIATION_GRACE_DAYS ?? 30);

export interface ReconciliationSummary {
  ok: boolean;
  checked: number;
  flaggedImpago: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}

interface CandidateRow {
  id: string;
  client_unit_id: string;
  mp_preapproval_id: string | null;
  cycle_started_at: string;
}

interface ClientUnitRow {
  id: string;
  unit_code: string;
  access_user: string | null;
  client_id: string;
}

async function sendDunningEmailSafely(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  unit: ClientUnitRow,
): Promise<void> {
  let payerEmail = unit.access_user;
  if (!payerEmail) {
    const { data: clientRow } = await db
      .from("clients")
      .select("email, name")
      .eq("id", unit.client_id)
      .maybeSingle();
    payerEmail = (clientRow as { email: string | null } | null)?.email ?? null;
  }
  if (!payerEmail) {
    console.error(
      `[billing-reconciliation] no payer email for client_unit ${unit.id} — dunning email not sent`,
    );
    return;
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.nodocore.com.ar").replace(
    /\/$/,
    "",
  );

  try {
    await sendPaymentOverdueEmail({
      nombre: payerEmail,
      email: payerEmail,
      nodeLabel: unit.unit_code,
      // Placeholder until Phase 6 wires each nodo's own Suscripción screen URL.
      subscriptionUrl: `${appUrl}/panel/facturacion`,
      unitCode: unit.unit_code,
    });
  } catch (err) {
    console.error(
      `[billing-reconciliation] dunning email failed for client_unit ${unit.id}:`,
      err,
    );
  }
}

/** Returns true if this subscription's client_unit was newly flipped to `impago`. */
async function reconcileOne(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  accessToken: string,
  sub: CandidateRow,
): Promise<boolean> {
  const cycleKey = currentCycleKey(new Date(sub.cycle_started_at));

  const { data: approvedPayment } = await db
    .from("subscription_payments")
    .select("id")
    .eq("subscription_id", sub.id)
    .eq("cycle_key", cycleKey)
    .eq("status", "approved")
    .maybeSingle();

  if (approvedPayment) return false; // Paid — nothing to reconcile.
  if (!sub.mp_preapproval_id) return false; // Never actually created in MP.

  const preapproval = await getPreapproval(accessToken, sub.mp_preapproval_id);
  if (preapproval.status === "authorized") return false; // MP says it's fine; webhook may just be delayed.

  const { data: updatedUnit } = await db
    .from("client_units")
    .update({ status: "impago" })
    .eq("id", sub.client_unit_id)
    .neq("status", "impago")
    .select("id, unit_code, access_user, client_id")
    .maybeSingle();

  await db
    .from("client_unit_subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("id", sub.id);

  if (!updatedUnit) return false; // Already impago — idempotent re-run, no duplicate email.

  await sendDunningEmailSafely(db, updatedUnit as ClientUnitRow);
  return true;
}

export async function runBillingReconciliation(): Promise<ReconciliationSummary> {
  const accessToken = process.env.LANDING_MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return {
      ok: false,
      checked: 0,
      flaggedImpago: 0,
      errors: [{ subscriptionId: "*", error: "missing_token" }],
    };
  }

  const db = createAdminClient();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - GRACE_DAYS);

  const { data: candidates, error } = await db
    .from("client_unit_subscriptions")
    .select("id, client_unit_id, mp_preapproval_id, cycle_started_at")
    .eq("status", "active")
    .lte("cycle_started_at", cutoff.toISOString());

  if (error) {
    return {
      ok: false,
      checked: 0,
      flaggedImpago: 0,
      errors: [{ subscriptionId: "*", error: error.message }],
    };
  }

  const summary: ReconciliationSummary = { ok: true, checked: 0, flaggedImpago: 0, errors: [] };

  for (const sub of (candidates ?? []) as CandidateRow[]) {
    summary.checked += 1;
    try {
      const flagged = await reconcileOne(db, accessToken, sub);
      if (flagged) summary.flaggedImpago += 1;
    } catch (err) {
      summary.errors.push({
        subscriptionId: sub.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}
