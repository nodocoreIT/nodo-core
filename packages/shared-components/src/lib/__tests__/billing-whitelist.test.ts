import { describe, expect, it } from "vitest";
import { isBillingWhitelistedPath } from "../billing-whitelist";

describe("isBillingWhitelistedPath", () => {
  const allowlist = ["/settings/subscription"];

  it("matches an exact path", () => {
    expect(isBillingWhitelistedPath("/settings/subscription", allowlist)).toBe(true);
  });

  it("matches a sub-path", () => {
    expect(isBillingWhitelistedPath("/settings/subscription/plans", allowlist)).toBe(true);
  });

  it("does not match an unrelated path", () => {
    expect(isBillingWhitelistedPath("/dashboard", allowlist)).toBe(false);
  });

  it("does not match a different path that merely shares a prefix", () => {
    expect(isBillingWhitelistedPath("/settings/subscription-extra", allowlist)).toBe(false);
  });

  it("ignores a trailing slash on either side", () => {
    expect(isBillingWhitelistedPath("/settings/subscription/", allowlist)).toBe(true);
    expect(isBillingWhitelistedPath("/settings/subscription", ["/settings/subscription/"])).toBe(
      true,
    );
  });

  it("returns false for an empty allowlist", () => {
    expect(isBillingWhitelistedPath("/settings/subscription", [])).toBe(false);
  });
});
