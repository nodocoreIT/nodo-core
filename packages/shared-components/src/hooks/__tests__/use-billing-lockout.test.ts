import { describe, expect, it } from "vitest";
import { useBillingLockout } from "../use-billing-lockout";

describe("useBillingLockout", () => {
  it("allows every route when not locked", () => {
    expect(
      useBillingLockout({
        billingLocked: false,
        pathname: "/dashboard",
        subscriptionPath: "/settings/subscription",
      }),
    ).toEqual({ shouldRedirect: false, redirectTo: null });
  });

  it("allows the whitelisted route when locked", () => {
    expect(
      useBillingLockout({
        billingLocked: true,
        pathname: "/settings/subscription",
        subscriptionPath: "/settings/subscription",
      }),
    ).toEqual({ shouldRedirect: false, redirectTo: null });
  });

  it("redirects any other route when locked", () => {
    expect(
      useBillingLockout({
        billingLocked: true,
        pathname: "/dashboard",
        subscriptionPath: "/settings/subscription",
      }),
    ).toEqual({ shouldRedirect: true, redirectTo: "/settings/subscription" });
  });

  it("fails closed with no redirect target when no Suscripción screen is configured", () => {
    expect(
      useBillingLockout({
        billingLocked: true,
        pathname: "/dashboard",
      }),
    ).toEqual({ shouldRedirect: true, redirectTo: null });
  });

  it("also fails closed on an empty allowlist array", () => {
    expect(
      useBillingLockout({
        billingLocked: true,
        pathname: "/dashboard",
        subscriptionPath: [],
      }),
    ).toEqual({ shouldRedirect: true, redirectTo: null });
  });

  it("accepts an array allowlist with more than one whitelisted route", () => {
    expect(
      useBillingLockout({
        billingLocked: true,
        pathname: "/settings/billing-history",
        subscriptionPath: ["/settings/subscription", "/settings/billing-history"],
      }),
    ).toEqual({ shouldRedirect: false, redirectTo: null });
  });
});
