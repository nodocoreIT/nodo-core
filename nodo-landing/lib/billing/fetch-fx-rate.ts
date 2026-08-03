import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fetches the current "dólar oficial" (official/wholesale, sell side) rate
 * from dolarapi.com and upserts it into nodo_core.fx_rates for today, keyed
 * (rate_date, source='dolarapi'). Feeds resolveFxRate()'s fallback chain
 * (lib/billing/fx-rate.ts). Wired into a daily cron —
 * app/api/cron/refresh-fx-rate/route.ts.
 */

const DOLARAPI_OFICIAL_URL = "https://dolarapi.com/v1/dolares/oficial";
const SOURCE = "dolarapi";

interface DolarApiOficialResponse {
  moneda?: string;
  casa?: string;
  nombre?: string;
  compra?: number;
  venta?: number;
  fechaActualizacion?: string;
}

export interface FetchFxRateResult {
  ok: boolean;
  rate?: number;
  rateDate?: string;
  error?: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Fetches today's dólar oficial "venta" rate and upserts it into
 * nodo_core.fx_rates. Never throws — network/parse/DB failures are returned
 * as `{ ok: false, error }` so the cron handler can log and return a 500
 * without crashing, leaving resolveFxRate()'s stale/manual fallbacks intact.
 */
export async function fetchAndStoreFxRate(
  referenceDate: Date = new Date(),
): Promise<FetchFxRateResult> {
  let payload: DolarApiOficialResponse;

  try {
    const res = await fetch(DOLARAPI_OFICIAL_URL, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, error: `dolarapi.com responded with HTTP ${res.status}` };
    }
    payload = (await res.json()) as DolarApiOficialResponse;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const rate = payload.venta;
  if (typeof rate !== "number" || !(rate > 0)) {
    return { ok: false, error: "dolarapi.com returned no usable 'venta' rate for dólar oficial" };
  }

  const rateDate = toIsoDate(referenceDate);
  const db = createAdminClient(); // nodo_core schema

  const { error } = await db
    .from("fx_rates")
    .upsert({ rate_date: rateDate, rate, source: SOURCE }, { onConflict: "rate_date,source" });

  if (error) {
    return { ok: false, error: `Failed to store fx_rates row: ${error.message}` };
  }

  return { ok: true, rate, rateDate };
}
