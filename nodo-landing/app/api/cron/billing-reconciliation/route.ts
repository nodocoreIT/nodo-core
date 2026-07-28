import { NextRequest, NextResponse } from "next/server";
import { runBillingReconciliation } from "@/lib/billing/billing-reconciliation";

/**
 * GET /api/cron/billing-reconciliation
 *
 * Daily safety-net poll that flips `client_units.status` to `impago` for
 * subscriptions well past their cycle with no approved payment on record,
 * after confirming MP's own terminal state. Ships OFF by default —
 * BILLING_RECONCILIATION_ENABLED must be explicitly set to "true" once the
 * MP Preapproval flow has been validated end-to-end (Phase 6).
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (process.env.BILLING_RECONCILIATION_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "feature_flag_disabled" });
  }

  const summary = await runBillingReconciliation();

  if (!summary.ok) {
    console.error("[cron/billing-reconciliation] failed:", summary.errors);
    return NextResponse.json(summary, { status: 500 });
  }

  console.log("[cron/billing-reconciliation] summary:", JSON.stringify(summary));
  return NextResponse.json(summary);
}
