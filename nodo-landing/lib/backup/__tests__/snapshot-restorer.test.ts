import { describe, it, expect, vi, beforeEach } from "vitest";
import { gzipSync } from "zlib";
import type { OrgSnapshot } from "../snapshot-builder";

// ─── Mock Supabase clients ────────────────────────────────────────────────────

const mockGetSnapshotRow = vi.fn();
const mockStorageDownload = vi.fn();
const mockUpdateSnapshot = vi.fn();
const mockGetUser = vi.fn();
const mockCreateUser = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "backup_snapshots") {
        return {
          select: () => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: mockGetSnapshotRow,
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      return {};
    },
    storage: {
      from: () => ({
        download: mockStorageDownload,
      }),
    },
  }),
}));

vi.mock("@/lib/supabase/nodo-admin", () => ({
  createNodoAdminClient: () => ({
    schema: (schema: string) => ({
      from: (_table: string) => ({
        upsert: mockUpsert,
      }),
    }),
    auth: {
      admin: {
        getUserById: mockGetUser,
        createUser: mockCreateUser,
      },
    },
  }),
}));

// Import after mocks.
import { restoreSnapshot } from "../snapshot-restorer";
import { NODO_INMO_RESTORE_ORDER } from "../table-order";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<OrgSnapshot> = {}): OrgSnapshot {
  const tables: Record<string, unknown[]> = {};
  for (const entry of NODO_INMO_RESTORE_ORDER) {
    tables[`${entry.schema}.${entry.table}`] = [];
  }

  return {
    schema_version: 1,
    nodo: "nodo_inmo",
    org_id: "org-uuid",
    captured_at: new Date().toISOString(),
    auth_users: [],
    tables,
    row_counts: {},
    ...overrides,
  };
}

function gzipSnapshot(snapshot: OrgSnapshot): Blob {
  const json = JSON.stringify(snapshot);
  const compressed = gzipSync(Buffer.from(json, "utf-8"));
  return new Blob([compressed], { type: "application/gzip" });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("restoreSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: snapshot row found.
    mockGetSnapshotRow.mockResolvedValue({
      data: { id: "snap-uuid", snapshot_path: "nodo_inmo/org-uuid/ts.json.gz", nodo: "nodo_inmo" },
      error: null,
    });

    // Default: download returns a valid empty-tables snapshot.
    const defaultSnapshot = makeSnapshot();
    mockStorageDownload.mockResolvedValue({
      data: gzipSnapshot(defaultSnapshot),
      error: null,
    });

    // Default: users do not need re-creation.
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });

    // Default: upsert succeeds with 0 rows inserted.
    mockUpsert.mockResolvedValue({ error: null, count: 0 });
  });

  it("dry_run: true returns report without calling upsert or createUser", async () => {
    const snapshot = makeSnapshot({
      auth_users: [
        { id: "user-1", email: "u@e.com", user_metadata: {}, created_at: new Date().toISOString() },
      ],
    });
    mockStorageDownload.mockResolvedValueOnce({
      data: gzipSnapshot(snapshot),
      error: null,
    });

    const report = await restoreSnapshot("snap-uuid", true);

    expect(report.dry_run).toBe(true);
    expect(report.status).toBe("success");
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("missing auth users trigger createUser before table inserts", async () => {
    const snapshot = makeSnapshot({
      auth_users: [
        { id: "missing-user", email: "m@e.com", user_metadata: {}, created_at: new Date().toISOString() },
      ],
    });
    mockStorageDownload.mockResolvedValueOnce({
      data: gzipSnapshot(snapshot),
      error: null,
    });

    // User does not exist → getUserById returns null user.
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    mockCreateUser.mockResolvedValueOnce({ error: null });

    const report = await restoreSnapshot("snap-uuid", false);

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "missing-user", email: "m@e.com" }),
    );
    expect(report.auth_users.created).toBe(1);
  });

  it("createUser failure in non-dry-run returns status: failed with no table inserts", async () => {
    const snapshot = makeSnapshot({
      auth_users: [
        { id: "bad-user", email: "b@e.com", user_metadata: {}, created_at: new Date().toISOString() },
      ],
    });
    mockStorageDownload.mockResolvedValueOnce({
      data: gzipSnapshot(snapshot),
      error: null,
    });

    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    mockCreateUser.mockResolvedValueOnce({ error: { message: "Auth service unavailable" } });

    const report = await restoreSnapshot("snap-uuid", false);

    expect(report.status).toBe("failed");
    expect(report.error).toMatch(/bad-user/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("idempotency: inserting same rows twice returns no errors (DO NOTHING behavior)", async () => {
    // Simulate that upsert with ignoreDuplicates: true returns 0 inserted on second run.
    mockUpsert.mockResolvedValue({ error: null, count: 0 });

    const report1 = await restoreSnapshot("snap-uuid", false);
    const report2 = await restoreSnapshot("snap-uuid", false);

    expect(report1.status).toBe("success");
    expect(report2.status).toBe("success");

    // No errors in either run.
    for (const tableResult of Object.values(report1.tables)) {
      expect(tableResult.errors).toHaveLength(0);
    }
    for (const tableResult of Object.values(report2.tables)) {
      expect(tableResult.errors).toHaveLength(0);
    }
  });

  it("returns status: failed when snapshot is not found", async () => {
    mockGetSnapshotRow.mockResolvedValueOnce({ data: null, error: null });

    const report = await restoreSnapshot("nonexistent-uuid", false);

    expect(report.status).toBe("failed");
    expect(report.error).toMatch(/not found/i);
  });
});
