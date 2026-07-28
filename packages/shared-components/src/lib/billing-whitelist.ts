/**
 * Central whitelisting logic for the billing-lockout gate (see spec
 * `billing-lockout` — "Central Whitelisted-Route Enforcement"). Pure matcher
 * only — redirect side effects stay in each nodo's own layout/hook wiring.
 */

/** One or more path prefixes that stay reachable while `billingLocked` is true. */
export type SubscriptionRouteAllowlist = readonly string[];

function normalize(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

/**
 * Returns true when `path` matches an entry in `allowlist`, either exactly or
 * as a sub-path (`/settings/subscription/plans` matches allowlist entry
 * `/settings/subscription`).
 */
export function isBillingWhitelistedPath(
  path: string,
  allowlist: SubscriptionRouteAllowlist,
): boolean {
  const target = normalize(path);
  return allowlist.some((entry) => {
    const normalizedEntry = normalize(entry);
    return (
      target === normalizedEntry ||
      target.startsWith(`${normalizedEntry}/`)
    );
  });
}
