/**
 * snapshot-builder.ts
 *
 * Core backup logic: queries all org-scoped tables in FK order,
 * fetches the auth.users subset for org members, assembles an OrgSnapshot JSON,
 * gzip-compresses it, uploads to nodo_core Storage, and registers metadata in
 * nodo_core.backup_snapshots.
 *
 * Server-only — never import from a Client Component.
 */

import { gzipSync } from "zlib";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { NODO_INMO_BACKUP_ORDER, type TableEntry } from "./table-order";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrgSnapshotAuthUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
  created_at: string;
}

export interface OrgSnapshot {
  schema_version: 1;
  nodo: "nodo_inmo";
  org_id: string;
  captured_at: string; // ISO 8601 UTC — serialization start time
  auth_users: OrgSnapshotAuthUser[];
  tables: Record<string, unknown[]>; // keyed as "{schema}.{table}"
  row_counts: Record<string, number>;
}

export interface SnapshotResult {
  ok: true;
  snapshot_path: string;
  row_counts: Record<string, number>;
  size_bytes: number;
  duration_ms: number;
}

export interface SnapshotError {
  ok: false;
  error: string;
  status: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Paginates a table query in 1000-row batches to avoid memory spikes. */
async function fetchAllRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  entry: TableEntry,
  orgId: string,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .schema(entry.schema)
      .from(entry.table)
      .select("*")
      .eq(entry.orgIdColumn, orgId)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch ${entry.schema}.${entry.table}: ${error.message}`);
    }

    const batch = (data ?? []) as unknown[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

/** Formats a Date as a storage-path-safe ISO timestamp (e.g. "2026-07-11T02:00:00Z"). */
function toStorageTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Executes a full backup for one org within one nodo.
 *
 * @param orgId  UUID of the organization to back up.
 * @param nodo   Target nodo identifier. Currently only "nodo_inmo" is supported.
 * @param triggeredBy  Who triggered this backup ("cron" | "manual").
 * @param createdBy    UUID of the panel user who triggered it (null for cron).
 */
export async function buildSnapshot(
  orgId: string,
  nodo: "nodo_inmo",
  triggeredBy: "cron" | "manual" = "manual",
  createdBy: string | null = null,
): Promise<SnapshotResult | SnapshotError> {
  const startMs = Date.now();
  const capturedAt = new Date().toISOString();

  // ── 1. Verify org exists ─────────────────────────────────────────────────
  const nodoAdmin = createNodoAdminClient("inmo");
  if (!nodoAdmin) {
    return { ok: false, error: "nodo_inmo is not configured on this server.", status: 500 };
  }

  const { data: org, error: orgErr } = await nodoAdmin
    .schema("shared")
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .maybeSingle();

  if (orgErr) {
    return { ok: false, error: orgErr.message, status: 500 };
  }
  if (!org) {
    return { ok: false, error: "org not found", status: 404 };
  }

  // ── 2. Fetch all tables in FK order ──────────────────────────────────────
  const tables: Record<string, unknown[]> = {};
  const rowCounts: Record<string, number> = {};

  for (const entry of NODO_INMO_BACKUP_ORDER) {
    const key = `${entry.schema}.${entry.table}`;
    try {
      const rows = await fetchAllRows(nodoAdmin, entry, orgId);
      tables[key] = rows;
      rowCounts[key] = rows.length;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        status: 500,
      };
    }
  }

  // ── 3. Fetch auth.users subset (only org members) ────────────────────────
  const memberRows = tables["shared.org_members"] as Array<{ user_id: string }>;
  const memberUserIds = new Set(memberRows.map((m) => m.user_id).filter(Boolean));

  const authUsers: OrgSnapshotAuthUser[] = [];

  if (memberUserIds.size > 0) {
    // listUsers paginates up to 1000 per page; iterate all pages.
    let page = 1;
    const PER_PAGE = 1000;

    while (true) {
      const { data: usersPage, error: listErr } = await nodoAdmin.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      });

      if (listErr) {
        return { ok: false, error: `auth.admin.listUsers failed: ${listErr.message}`, status: 500 };
      }

      for (const u of usersPage.users) {
        if (memberUserIds.has(u.id)) {
          authUsers.push({
            id: u.id,
            email: u.email ?? "",
            user_metadata: (u.user_metadata ?? {}) as Record<string, unknown>,
            created_at: u.created_at,
          });
        }
      }

      if (usersPage.users.length < PER_PAGE) break;
      page++;
    }
  }

  // ── 4. Assemble OrgSnapshot ───────────────────────────────────────────────
  const snapshot: OrgSnapshot = {
    schema_version: 1,
    nodo,
    org_id: orgId,
    captured_at: capturedAt,
    auth_users: authUsers,
    tables,
    row_counts: rowCounts,
  };

  // ── 5. Gzip compress ─────────────────────────────────────────────────────
  const jsonBuffer = Buffer.from(JSON.stringify(snapshot), "utf-8");
  const compressed = gzipSync(jsonBuffer);
  const sizeBytes = compressed.length;

  // ── 6. Upload to nodo_core Storage ───────────────────────────────────────
  const coreAdmin = createAdminClient();
  const timestampSlug = toStorageTimestamp(new Date(capturedAt));
  const storagePath = `${nodo}/${orgId}/${timestampSlug}.json.gz`;

  const { error: uploadErr } = await coreAdmin.storage
    .from("org-backups")
    .upload(storagePath, compressed, {
      contentType: "application/gzip",
      upsert: false,
    });

  if (uploadErr) {
    // Do NOT insert metadata row on upload failure.
    return {
      ok: false,
      error: `Storage upload failed: ${uploadErr.message}`,
      status: 500,
    };
  }

  // ── 7. Insert metadata row ────────────────────────────────────────────────
  const { error: insertErr } = await coreAdmin
    .from("backup_snapshots")
    .insert({
      org_id: orgId,
      nodo,
      snapshot_path: storagePath,
      row_counts: rowCounts,
      size_bytes: sizeBytes,
      status: "completed",
      triggered_by: triggeredBy,
      created_by: createdBy,
    });

  if (insertErr) {
    // Snapshot file exists but metadata row failed — log and return error.
    console.error("[buildSnapshot] metadata insert failed:", insertErr.message);
    return {
      ok: false,
      error: `Snapshot uploaded but metadata registration failed: ${insertErr.message}`,
      status: 500,
    };
  }

  const durationMs = Date.now() - startMs;

  return {
    ok: true,
    snapshot_path: storagePath,
    row_counts: rowCounts,
    size_bytes: sizeBytes,
    duration_ms: durationMs,
  };
}
