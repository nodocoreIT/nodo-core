import {
  isBillingWhitelistedPath,
  type SubscriptionRouteAllowlist,
} from "../lib/billing-whitelist";

export interface UseBillingLockoutOptions {
  /** `AuthContextValue.billingLocked` — true when the session's client_unit is impago. */
  billingLocked: boolean;
  /** Current pathname (e.g. from Next.js `usePathname()`). */
  pathname: string;
  /**
   * The nodo's own Suscripción route(s). Undefined/empty means the nodo hasn't
   * built its Suscripción screen yet — the gate fails CLOSED (spec: "Missing
   * Suscripción Screen Fails Safe") and blocks every route, with no redirect
   * target: the caller should render a generic notice instead.
   */
  subscriptionPath?: SubscriptionRouteAllowlist | string;
}

export interface BillingLockoutResult {
  /** True when the current route must be blocked. */
  shouldRedirect: boolean;
  /**
   * Where to redirect to, or `null` when there is nowhere safe to send the
   * user (no Suscripción screen configured yet) — render a generic notice
   * instead of redirecting.
   */
  redirectTo: string | null;
}

/**
 * Pure decision function for the billing-lockout gate (spec `billing-lockout`).
 * Each nodo's layout calls this with its own Suscripción path and performs the
 * actual redirect — this package only decides whether one is needed.
 *
 * Client-side only. Spec requirement "Server-Side (API) Enforcement" (direct
 * API calls must be rejected too, not just blocked via navigation) is each
 * nodo's own responsibility: wire a middleware/route check using
 * `AuthContextValue.billingLocked`/`accessReason` and `isBillingWhitelistedPath`
 * against that nodo's own API routes. This package exposes the state and the
 * matcher only — it does not run on the server.
 */
export function useBillingLockout({
  billingLocked,
  pathname,
  subscriptionPath,
}: UseBillingLockoutOptions): BillingLockoutResult {
  if (!billingLocked) {
    return { shouldRedirect: false, redirectTo: null };
  }

  const allowlist: SubscriptionRouteAllowlist =
    typeof subscriptionPath === "string"
      ? [subscriptionPath]
      : (subscriptionPath ?? []);

  if (allowlist.length === 0) {
    return { shouldRedirect: true, redirectTo: null };
  }

  if (isBillingWhitelistedPath(pathname, allowlist)) {
    return { shouldRedirect: false, redirectTo: null };
  }

  return { shouldRedirect: true, redirectTo: allowlist[0] };
}
