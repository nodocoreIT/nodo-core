/**
 * Free/Demo plan trial window.
 *
 * Nodo Clínica has no feature difference between "Free" and "Pro" — the only
 * difference is access time: Free lasts TRIAL_DAYS from signup, Pro is
 * unlimited while the recurring MercadoPago subscription is active.
 */
export const TRIAL_DAYS = 10;

/** ISO string for `from` + TRIAL_DAYS. */
export function computeTrialEndsAt(from: Date = new Date()): string {
  const endsAt = new Date(from);
  endsAt.setDate(endsAt.getDate() + TRIAL_DAYS);
  return endsAt.toISOString();
}

export function isTrialExpired(trialEndsAt: string | null | undefined): boolean {
  return trialEndsAt != null && new Date(trialEndsAt).getTime() < Date.now();
}

/** Days remaining, rounded up, floored at 0. Returns 0 when trialEndsAt is null/undefined. */
export function trialDaysRemaining(trialEndsAt: string | null | undefined): number {
  if (trialEndsAt == null) return 0;
  return Math.max(
    0,
    Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000),
  );
}

/**
 * Whether the doctor currently has access. `"active"` is always true.
 * `"trial"` is true only while the trial window hasn't expired. Anything
 * else (including `"expired"`) is false.
 */
export function isSubscriptionActive(professional: {
  subscription_status: string | null;
  trial_ends_at?: string | null;
}): boolean {
  if (professional.subscription_status === "active") return true;
  if (professional.subscription_status === "trial") {
    return !isTrialExpired(professional.trial_ends_at);
  }
  return false;
}
