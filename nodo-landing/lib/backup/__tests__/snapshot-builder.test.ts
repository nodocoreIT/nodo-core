import { describe, it, expect, vi, beforeEach } from "vitest";
import { gzipSync, gunzipSync } from "zlib";

// ─── Mock Supabase clients ────────────────────────────────────────────────────

// We mock the factory modules so buildSnapshot never makes real network calls.

const mockStorageUpload = vi.fn();
const mockSnapshotInsert = vi.fn();
const mockOrgSelect = vi.fn();
const mockTableSelect = vi.fn();
const mockListUsers = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: mockStorageUpload,
      }),
    },
    from: () => ({
      insert: mockSnapshotInsert,
    }),
  }),
}));

vi.mock("@/lib/supabase/nodo-admin", () => ({
  createNodoAdminClient: () => ({
    schema: (schema: string) => ({
      from: (table: string) => ({
        select: () => ({
          eq: (col: string, val: string) => ({
            maybeSingle: () => mockOrgSelect(schema, table, col, val),
            range: (from: number, to: number) => mockTableSelect(schema, table, from, to),
          }),
        }),
      }),
    }),
    auth: {
      admin: {
        listUsers: mockListUsers,
      },
    },
  }),
}));

// Import after mocks are set up.
import { buildSnapshot } from "../snapshot-builder";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: org exists.
    mockOrgSelect.mockResolvedValue({ data: { id: "org-uuid" }, error: null });

    // Default: all tables return empty (first page = 0 rows → done).
    mockTableSelect.mockResolvedValue({ data: [], error: null });

    // Default: no auth users.
    mockListUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    // Default: upload succeeds.
    mockStorageUpload.mockResolvedValue({ error: null });

    // Default: insert succeeds.
    mockSnapshotInsert.mockResolvedValue({ error: null });
  });

  it("returns error and does not call upload for unknown org_id", async () => {
    mockOrgSelect.mockResolvedValueOnce({ data: null, error: null });

    const result = await buildSnapshot("unknown-uuid", "nodo_inmo");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error).toMatch(/not found/i);
    }
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("returns ok with all-zero row_counts for an org with no data", async () => {
    const result = await buildSnapshot("org-uuid", "nodo_inmo");

    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const count of Object.values(result.row_counts)) {
        expect(count).toBe(0);
      }
    }
  });

  it("does not insert metadata row when upload fails", async () => {
    mockStorageUpload.mockResolvedValueOnce({
      error: { message: "Storage quota exceeded" },
    });

    const result = await buildSnapshot("org-uuid", "nodo_inmo");

    expect(result.ok).toBe(false);
    expect(mockSnapshotInsert).not.toHaveBeenCalled();
  });

  it("snapshot JSON contains all required top-level keys with schema_version 1", async () => {
    // Capture what gets gzipped by inspecting the upload call.
    let capturedBuffer: Buffer | null = null;
    mockStorageUpload.mockImplementationOnce((path: string, buf: Buffer) => {
      capturedBuffer = buf;
      return Promise.resolve({ error: null });
    });

    const result = await buildSnapshot("org-uuid", "nodo_inmo");
    expect(result.ok).toBe(true);
    expect(capturedBuffer).not.toBeNull();

    const decompressed = gunzipSync(capturedBuffer!);
    const parsed = JSON.parse(decompressed.toString("utf-8"));

    expect(parsed.schema_version).toBe(1);
    expect(parsed.nodo).toBe("nodo_inmo");
    expect(parsed.org_id).toBe("org-uuid");
    expect(typeof parsed.captured_at).toBe("string");
    expect(Array.isArray(parsed.auth_users)).toBe(true);
    expect(typeof parsed.tables).toBe("object");
    expect(typeof parsed.row_counts).toBe("object");
  });

  it("storage path matches org-backups/nodo_inmo/{org_id}/{timestamp}.json.gz", async () => {
    let capturedPath: string | null = null;
    mockStorageUpload.mockImplementationOnce((path: string) => {
      capturedPath = path;
      return Promise.resolve({ error: null });
    });

    await buildSnapshot("org-uuid", "nodo_inmo");

    expect(capturedPath).toMatch(/^nodo_inmo\/org-uuid\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\.json\.gz$/);
  });

  it("gzip round-trip: compress then decompress returns identical JSON", () => {
    const payload = { test: true, data: [1, 2, 3] };
    const json = JSON.stringify(payload);
    const compressed = gzipSync(Buffer.from(json, "utf-8"));
    const decompressed = gunzipSync(compressed).toString("utf-8");
    expect(JSON.parse(decompressed)).toEqual(payload);
  });
});
