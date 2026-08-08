/**
 * Regression test for a critical multi-node bug: a Finanzas-only account
 * (which never got an org_id — Finanzas has no per-node org concept) had its
 * global app_metadata.role silently overwritten the moment the same email
 * registered in Inmo or Clínica, because hasForeignMembership() had nothing
 * to compare against and defaulted to "not foreign" — locking the user out
 * of Finanzas with no error anywhere.
 *
 * Fixed by having Finanzas provisioning write a sentinel org_id (the user's
 * own id) so later registrations from other nodos correctly detect this
 * account already belongs elsewhere and skip the role/org_id overwrite.
 */
import { describe, it, expect } from "vitest";
import { hasForeignMembership } from "../auth-user-lookup";

describe("hasForeignMembership", () => {
  it("returns false (unprotected) when the account has no org_id at all", () => {
    // This was the exact gap: a Finanzas-only account with no org_id looked
    // indistinguishable from a brand-new global user.
    expect(hasForeignMembership({ role: "user" }, "some-other-node-org-id")).toBe(false);
  });

  it("returns true once a sentinel org_id is present and a different node registers", () => {
    const financasUserId = "47c181c5-dd9e-438c-a5d5-854ccb4fc7eb";
    const metadata = { role: "user", org_id: financasUserId };
    expect(hasForeignMembership(metadata, "some-other-node-org-id")).toBe(true);
  });

  it("returns false when the SAME node re-provisions its own org_id", () => {
    const orgId = "same-node-org-id";
    expect(hasForeignMembership({ role: "admin", org_id: orgId }, orgId)).toBe(false);
  });
});
