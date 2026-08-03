import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolves the dólar oficial (venta) FX rate used to convert nodo_core.planes
 * USD prices to ARS at MercadoPago debit time.
 *
 * Fallback chain (design.md — "FX rate source"):
 *   1. Today's fetched rate (source = "dolarapi", rate_date = today)
 *   2. Most recent stored rate within STALE_FALLBACK_DAYS days (source = "dolarapi")
 *   3. Admin manual override row (source = "manual", most recent)
 *   4. All missing/stale → explicit failure. NEVER returns rate 0, NEVER throws.
 */

const DOLARAPI_SOURCE = "dolarapi";
const MANUAL_SOURCE = "manual";

/** Max age (in days) a stored "dolarapi" rate may be before it's considered stale. */
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

/**
 * Resolves the FX rate to use for a charge happening on `referenceDate`
 * (defaults to now). Never charges $0 and never throws — an unresolved rate
 * is returned as an explicit `FxRateUnavailable` result so callers can record
 * the failure in `subscription_payments` and retry on the next reconciliation
 * pass instead of crashing or silently skipping the cycle.
 */
export async function resolveFxRate(
  referenceDate: Date = new Date(),
): Promise<FxRateResult> {
  const db = createAdminClient(); // nodo_core schema (service_role, bypasses RLS)
  const todayIso = toIsoDate(referenceDate);

  // ── 1. Today's fetched rate ────────────────────────────────────────────
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

  // ── 2. Most recent stored rate within the staleness window ────────────
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

  // ── 3. Admin manual override row ───────────────────────────────────────
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

  // ── 4. All missing/stale — explicit failure, never $0, never throw ────
  return {
    ok: false,
    reason: "fx-unavailable",
    detail:
      "No dólar oficial rate available: today's fetch, the stale fallback window, and the manual override are all missing.",
  };
}
