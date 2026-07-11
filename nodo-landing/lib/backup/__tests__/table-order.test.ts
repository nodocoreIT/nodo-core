import { describe, it, expect } from "vitest";
import {
  NODO_INMO_BACKUP_ORDER,
  NODO_INMO_RESTORE_ORDER,
  PURGE_COVERS_SHARED_FEEDBACK,
} from "../table-order";

describe("table-order", () => {
  it("BACKUP_ORDER and RESTORE_ORDER are the same array reference", () => {
    expect(NODO_INMO_RESTORE_ORDER).toBe(NODO_INMO_BACKUP_ORDER);
  });

  it("has exactly 17 entries", () => {
    expect(NODO_INMO_BACKUP_ORDER).toHaveLength(17);
  });

  it("first entry is shared.organizations", () => {
    const first = NODO_INMO_BACKUP_ORDER[0];
    expect(first.schema).toBe("shared");
    expect(first.table).toBe("organizations");
    expect(first.orgIdColumn).toBe("id");
  });

  it("last entry is shared.feedback", () => {
    const last = NODO_INMO_BACKUP_ORDER[NODO_INMO_BACKUP_ORDER.length - 1];
    expect(last.schema).toBe("shared");
    expect(last.table).toBe("feedback");
  });

  it("cash_movements is second-to-last (before feedback)", () => {
    const secondToLast = NODO_INMO_BACKUP_ORDER[NODO_INMO_BACKUP_ORDER.length - 2];
    expect(secondToLast.schema).toBe("nodo_inmo");
    expect(secondToLast.table).toBe("cash_movements");
  });

  it("shared.org_members is second (after shared.organizations)", () => {
    const second = NODO_INMO_BACKUP_ORDER[1];
    expect(second.schema).toBe("shared");
    expect(second.table).toBe("org_members");
  });

  it("every entry has schema, table, and orgIdColumn fields", () => {
    for (const entry of NODO_INMO_BACKUP_ORDER) {
      expect(typeof entry.schema).toBe("string");
      expect(entry.schema.length).toBeGreaterThan(0);
      expect(typeof entry.table).toBe("string");
      expect(entry.table.length).toBeGreaterThan(0);
      expect(typeof entry.orgIdColumn).toBe("string");
      expect(entry.orgIdColumn.length).toBeGreaterThan(0);
    }
  });

  it("does not include shared.user_profiles", () => {
    const hasUserProfiles = NODO_INMO_BACKUP_ORDER.some(
      (e) => e.schema === "shared" && e.table === "user_profiles",
    );
    expect(hasUserProfiles).toBe(false);
  });

  it("PURGE_COVERS_SHARED_FEEDBACK is true (feedback is included)", () => {
    expect(PURGE_COVERS_SHARED_FEEDBACK).toBe(true);
  });
});
