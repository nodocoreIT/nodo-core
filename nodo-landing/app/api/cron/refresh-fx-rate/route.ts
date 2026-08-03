import { NextRequest, NextResponse } from "next/server";
import { fetchAndStoreFxRate } from "@/lib/billing/fetch-fx-rate";

/**
 * GET /api/cron/refresh-fx-rate
 *
 * Vercel Cron handler — triggered daily at 19:00 UTC (16:00 ART), well after
 * dolarapi.com's dólar oficial rate is published for the day. The previous
 * 01:00 UTC schedule ran at 22:00 ART the prior evening — before that day's
 * rate existed — so nodo_core.fx_rates never got a usable "today" row.
 * Fetches the dólar oficial rate from dolarapi.com and upserts it into
 * nodo_core.fx_rates for today. Feeds resolveFxRate()'s fallback chain
 * (lib/billing/fx-rate.ts), used by the billing engine to convert USD plan
 * prices to ARS at charge time.
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const result = await fetchAndStoreFxRate();

  if (!result.ok) {
    console.error("[cron/refresh-fx-rate] failed:", result.error);
    return NextResponse.json(result, { status: 500 });
  }

  console.log("[cron/refresh-fx-rate] stored rate:", JSON.stringify(result));
  return NextResponse.json(result);
}
