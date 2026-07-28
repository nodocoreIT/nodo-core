const BUENOS_AIRES_TZ = "America/Argentina/Buenos_Aires";

/**
 * Day-of-month (1-31) in America/Argentina/Buenos_Aires for `date` — used as
 * MP's `auto_recurring.billing_day`. MP clamps this to a shorter month's last
 * day on its own when advancing the recurring cycle (per its Preapproval API);
 * verify against the MP sandbox before Phase 6 wires this to a live UI.
 */
export function billingDayFrom(date: Date): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: BUENOS_AIRES_TZ,
    day: "numeric",
  }).format(date);
  return Number(formatted);
}

/** Anniversary cycle key (e.g. "2026-07") in America/Argentina/Buenos_Aires for `date`. */
export function currentCycleKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUENOS_AIRES_TZ,
    year: "numeric",
    month: "2-digit",
  }).format(date);
}
