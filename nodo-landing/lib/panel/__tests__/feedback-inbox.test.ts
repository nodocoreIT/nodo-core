import { describe, it, expect } from "vitest";
import {
  countUnreadFeedback,
  mergeFeedbackInbox,
  ORG_NAME_FALLBACK,
  type RawFeedbackRow,
  type RawOrganizationRow,
  type RawReadStateRow,
} from "../feedback-inbox";

function feedbackRow(overrides: Partial<RawFeedbackRow> = {}): RawFeedbackRow {
  return {
    id: "fb-1",
    org_id: "org-1",
    user_id: "user-1",
    category: "bug",
    content: "Algo se rompió",
    metadata: { source_node: "inmo" },
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mergeFeedbackInbox", () => {
  it("resolves organization name when org_id matches", () => {
    const orgs: RawOrganizationRow[] = [{ id: "org-1", name: "Grupo Alfa" }];
    const [row] = mergeFeedbackInbox([feedbackRow()], orgs, []);

    expect(row.orgId).toBe("org-1");
    expect(row.orgName).toBe("Grupo Alfa");
  });

  it("falls back to a defined label when org_id is null", () => {
    const [row] = mergeFeedbackInbox([feedbackRow({ org_id: null })], [], []);

    expect(row.orgId).toBeNull();
    expect(row.orgName).toBe(ORG_NAME_FALLBACK);
  });

  it("falls back when org_id is present but has no matching organization row", () => {
    const [row] = mergeFeedbackInbox([feedbackRow({ org_id: "org-missing" })], [], []);

    expect(row.orgName).toBe(ORG_NAME_FALLBACK);
  });

  it("marks an item read when a read-state row exists for its feedback_id", () => {
    const readState: RawReadStateRow[] = [{ feedback_id: "fb-1", read_at: "2026-08-02T00:00:00.000Z" }];
    const [row] = mergeFeedbackInbox([feedbackRow()], [], readState);

    expect(row.read).toBe(true);
    expect(row.readAt).toBe("2026-08-02T00:00:00.000Z");
  });

  it("marks an item unread when no read-state row exists", () => {
    const [row] = mergeFeedbackInbox([feedbackRow()], [], []);

    expect(row.read).toBe(false);
    expect(row.readAt).toBeNull();
  });

  it("resolves legales and salud node labels (previously missing)", () => {
    const rows = mergeFeedbackInbox(
      [
        feedbackRow({ id: "fb-legales", metadata: { source_node: "legales" } }),
        feedbackRow({ id: "fb-salud", metadata: { source_node: "salud" } }),
      ],
      [],
      [],
    );

    expect(rows[0].sourceNodeLabel).toBe("NODO | Legales");
    expect(rows[1].sourceNodeLabel).toBe("NODO | Salud");
  });

  it("falls back to a generic node label for an unmapped source_node", () => {
    const [row] = mergeFeedbackInbox(
      [feedbackRow({ metadata: { source_node: "desconocido" } })],
      [],
      [],
    );

    expect(row.sourceNodeLabel).toBe("NODO | desconocido");
  });

  it("resolves a human-readable category label", () => {
    const [row] = mergeFeedbackInbox([feedbackRow({ category: "idea" })], [], []);

    expect(row.categoryLabel).toBe("Idea nueva");
  });

  it("falls back to 'unknown' for a category value outside the known enum", () => {
    const [row] = mergeFeedbackInbox([feedbackRow({ category: "algo-random" })], [], []);

    expect(row.category).toBe("unknown");
    expect(row.categoryLabel).toBe("Feedback");
  });

  it("computes unread count as total minus read (10 - 3 = 7)", () => {
    const feedback = Array.from({ length: 10 }, (_, i) => feedbackRow({ id: `fb-${i}` }));
    const readState: RawReadStateRow[] = Array.from({ length: 3 }, (_, i) => ({
      feedback_id: `fb-${i}`,
      read_at: "2026-08-02T00:00:00.000Z",
    }));

    const rows = mergeFeedbackInbox(feedback, [], readState);
    const unreadCount = rows.filter((r) => !r.read).length;

    expect(unreadCount).toBe(7);
  });

  it("returns an empty array for empty feedback history", () => {
    expect(mergeFeedbackInbox([], [], [])).toEqual([]);
  });
});

describe("countUnreadFeedback", () => {
  it("computes unread count as total minus read (10 - 3 = 7)", () => {
    const feedbackIds = Array.from({ length: 10 }, (_, i) => `fb-${i}`);
    const readFeedbackIds = Array.from({ length: 3 }, (_, i) => `fb-${i}`);

    expect(countUnreadFeedback(feedbackIds, readFeedbackIds)).toBe(7);
  });

  it("does not undercount when feedback_read_state has an orphaned feedback_id", () => {
    // feedback_id "fb-ghost" has no matching row in shared.feedback — e.g.
    // POST /read was called with a stale/invalid id. A naive
    // count(feedback) - count(read_state) would compute 3 - 2 = 1 here,
    // which is wrong: only "fb-1" is actually unread.
    const feedbackIds = ["fb-1", "fb-2", "fb-3"];
    const readFeedbackIds = ["fb-2", "fb-3", "fb-ghost"];

    expect(countUnreadFeedback(feedbackIds, readFeedbackIds)).toBe(1);
  });

  it("returns 0 when everything is read", () => {
    expect(countUnreadFeedback(["fb-1", "fb-2"], ["fb-1", "fb-2"])).toBe(0);
  });

  it("returns 0 for empty feedback history regardless of read state", () => {
    expect(countUnreadFeedback([], ["fb-ghost"])).toBe(0);
  });
});
