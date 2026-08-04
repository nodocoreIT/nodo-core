import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Resolves the dólar oficial (venta) FX rate used to convert nodo_core.planes
 * USD prices to ARS at MercadoPago debit time. Mirrors
 * nodo-landing/lib/billing/fx-rate.ts exactly (same nodo_core.fx_rates
 * table, same fallback chain) — ported instead of imported since
 * nodo-clinica is a separate Next.js app with no shared package for this.
 *
 * Fallback chain:
 *   1. Today's fetched rate (source = "dolarapi", rate_date = today)
 *   2. Most recent stored rate within STALE_FALLBACK_DAYS days (source = "dolarapi")
 *   3. Admin manual override row (source = "manual", most recent)
 *   4. All missing/stale → explicit failure. NEVER returns rate 0, NEVER throws.
 */

const DOLARAPI_SOURCE = "dolarapi";
const MANUAL_SOURCE = "manual";
const STALE_FALLBACK_DAYS = Number(process.env.FX_RATE_STALE_FALLBACK_DAYS ?? 3);

export type FxRateOrigin = "today" | "stale" | "manual";

export interface FxRateResolved {
  ok: true;
  rate: number;
  source: FxRateOrigin;
  rateDate: string;
}

export interface FxRateUnavailable {
  ok: false;
  reason: "fx-unavailable";
  detail: string;
}

export type FxRateResult = FxRateResolved | FxRateUnavailable;

interface FxRateRow {
  rate: number | string;
  rate_date: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function resolveFxRate(
  referenceDate: Date = new Date(),
): Promise<FxRateResult> {
  const service = await createServiceClient();
  const db = service.schema("nodo_core");
  const todayIso = toIsoDate(referenceDate);

  const { data: todayRow, error: todayErr } = await db
    .from("fx_rates")
    .select("rate, rate_date")
    .eq("rate_date", todayIso)
    .eq("source", DOLARAPI_SOURCE)
    .maybeSingle();

  if (todayErr) {
    console.error("[resolveFxRate] today lookup failed:", todayErr.message);
  }
  const today = todayRow as FxRateRow | null;
  if (today) {
    return { ok: true, rate: Number(today.rate), source: "today", rateDate: today.rate_date };
  }

  const cutoff = new Date(referenceDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - STALE_FALLBACK_DAYS);
  const cutoffIso = toIsoDate(cutoff);

  const { data: recentRow, error: recentErr } = await db
    .from("fx_rates")
    .select("rate, rate_date")
    .eq("source", DOLARAPI_SOURCE)
    .gte("rate_date", cutoffIso)
    .lte("rate_date", todayIso)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentErr) {
    console.error("[resolveFxRate] recent lookup failed:", recentErr.message);
  }
  const recent = recentRow as FxRateRow | null;
  if (recent) {
    return { ok: true, rate: Number(recent.rate), source: "stale", rateDate: recent.rate_date };
  }

  const { data: manualRow, error: manualErr } = await db
    .from("fx_rates")
    .select("rate, rate_date")
    .eq("source", MANUAL_SOURCE)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (manualErr) {
    console.error("[resolveFxRate] manual lookup failed:", manualErr.message);
  }
  const manual = manualRow as FxRateRow | null;
  if (manual) {
    return { ok: true, rate: Number(manual.rate), source: "manual", rateDate: manual.rate_date };
  }

  return {
    ok: false,
    reason: "fx-unavailable",
    detail:
      "No dólar oficial rate available: today's fetch, the stale fallback window, and the manual override are all missing.",
  };
}
