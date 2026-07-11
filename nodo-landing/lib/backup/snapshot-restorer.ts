/**
 * snapshot-restorer.ts
 *
 * Core restore logic: downloads a snapshot from Storage, decompresses it,
 * re-creates any missing auth.users, then inserts all table rows in FK order
 * using INSERT ON CONFLICT (id) DO NOTHING for idempotency.
 *
 * Server-only — never import from a Client Component.
 */

import { gunzipSync } from "zlib";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { NODO_INMO_RESTORE_ORDER } from "./table-order";
import type { OrgSnapshot, OrgSnapshotAuthUser } from "./snapshot-builder";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TableRestoreResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export interface AuthRestoreResult {
  created: number;
  skipped: number;
  errors: string[];
}

export interface RestoreReport {
  status: "success" | "partial" | "failed";
  dry_run: boolean;
  duration_ms: number;
  tables: Record<string, TableRestoreResult>;
  auth_users: AuthRestoreResult;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Inserts rows into a table using a raw RPC call that wraps
 * INSERT … SELECT * FROM jsonb_populate_recordset … ON CONFLICT (id) DO NOTHING.
 *
 * Returns { inserted, skipped } based on rows affected.
 * Because ON CONFLICT DO NOTHING silently discards conflicts, we derive
 * `skipped` as (input length - inserted).
 */
async function insertRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  schema: string,
  table: string,
  rows: unknown[],
): Promise<{ inserted: number; skipped: number; error?: string }> {
  if (rows.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  // Use raw SQL via rpc to support ON CONFLICT DO NOTHING with jsonb batch insert.
  // The function must exist in the target schema or be created as a helper.
  // We fall back to per-row upsert if the batch RPC is unavailable.
  //
  // Strategy: use .upsert() with ignoreDuplicates: true (equivalent to ON CONFLICT DO NOTHING).
  const { error, count } = await client
    .schema(schema)
    .from(table)
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    return { inserted: 0, skipped: 0, error: error.message };
  }

  const inserted = count ?? 0;
  const skipped = rows.length - inserted;

  return { inserted, skipped };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Restores a snapshot identified by its database record ID.
 *
 * @param snapshotId  UUID of the backup_snapshots row to restore from.
 * @param dryRun      When true, returns simulated report without any mutations.
 * @param restoredBy  UUID of the panel admin user who triggered the restore.
 */
export async function restoreSnapshot(
  snapshotId: string,
  dryRun = false,
  restoredBy?: string,
): Promise<RestoreReport> {
  const startMs = Date.now();

  const coreAdmin = createAdminClient();

  // ── 1. Fetch metadata row ─────────────────────────────────────────────────
  const { data: snapshotRow, error: rowErr } = await coreAdmin
    .from("backup_snapshots")
    .select("id, snapshot_path, nodo")
    .eq("id", snapshotId)
    .maybeSingle();

  if (rowErr || !snapshotRow) {
    return {
      status: "failed",
      dry_run: dryRun,
      duration_ms: Date.now() - startMs,
      tables: {},
      auth_users: { created: 0, skipped: 0, errors: [] },
      error: rowErr?.message ?? "Snapshot not found",
    };
  }

  // ── 2. Download file ──────────────────────────────────────────────────────
  const { data: fileBlob, error: downloadErr } = await coreAdmin.storage
    .from("org-backups")
    .download(snapshotRow.snapshot_path);

  if (downloadErr || !fileBlob) {
    return {
      status: "failed",
      dry_run: dryRun,
      duration_ms: Date.now() - startMs,
      tables: {},
      auth_users: { created: 0, skipped: 0, errors: [] },
      error: `Storage download failed: ${downloadErr?.message ?? "empty response"}`,
    };
  }

  // ── 3. Decompress + parse ─────────────────────────────────────────────────
  let snapshot: OrgSnapshot;
  try {
    const arrayBuffer = await fileBlob.arrayBuffer();
    const decompressed = gunzipSync(Buffer.from(arrayBuffer));
    snapshot = JSON.parse(decompressed.toString("utf-8")) as OrgSnapshot;
  } catch (err) {
    return {
      status: "failed",
      dry_run: dryRun,
      duration_ms: Date.now() - startMs,
      tables: {},
      auth_users: { created: 0, skipped: 0, errors: [] },
      error: `Failed to decompress/parse snapshot: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // ── 4. Dry-run early return ───────────────────────────────────────────────
  if (dryRun) {
    const tables: Record<string, TableRestoreResult> = {};
    for (const entry of NODO_INMO_RESTORE_ORDER) {
      const key = `${entry.schema}.${entry.table}`;
      const rows = (snapshot.tables[key] ?? []) as unknown[];
      tables[key] = { inserted: rows.length, skipped: 0, errors: [] };
    }

    return {
      status: "success",
      dry_run: true,
      duration_ms: Date.now() - startMs,
      tables,
      auth_users: {
        created: snapshot.auth_users.length,
        skipped: 0,
        errors: [],
      },
    };
  }

  // ── 5. Re-create missing auth.users ──────────────────────────────────────
  const nodoAdmin = createNodoAdminClient("inmo");
  if (!nodoAdmin) {
    return {
      status: "failed",
      dry_run: false,
      duration_ms: Date.now() - startMs,
      tables: {},
      auth_users: { created: 0, skipped: 0, errors: [] },
      error: "nodo_inmo is not configured on this server.",
    };
  }

  const authResult: AuthRestoreResult = { created: 0, skipped: 0, errors: [] };

  for (const user of snapshot.auth_users as OrgSnapshotAuthUser[]) {
    const { data: existingUser } = await nodoAdmin.auth.admin.getUserById(user.id);

    if (existingUser?.user) {
      authResult.skipped++;
      continue;
    }

    const { error: createErr } = await nodoAdmin.auth.admin.createUser({
      id: user.id, // preserve original UUID so all FK references remain valid
      email: user.email,
      user_metadata: user.user_metadata,
      email_confirm: true,
    });

    if (createErr) {
      authResult.errors.push(`user ${user.id}: ${createErr.message}`);
      // Auth user creation failure is fatal — abort without inserting table data.
      return {
        status: "failed",
        dry_run: false,
        duration_ms: Date.now() - startMs,
        tables: {},
        auth_users: authResult,
        error: `Failed to re-create auth user ${user.id}: ${createErr.message}`,
      };
    }

    authResult.created++;
  }

  // ── 6. Insert tables in FK order ─────────────────────────────────────────
  const tableResults: Record<string, TableRestoreResult> = {};

  for (const entry of NODO_INMO_RESTORE_ORDER) {
    const key = `${entry.schema}.${entry.table}`;
    const rows = (snapshot.tables[key] ?? []) as unknown[];

    if (rows.length === 0) {
      tableResults[key] = { inserted: 0, skipped: 0, errors: [] };
      continue;
    }

    const result = await insertRows(nodoAdmin, entry.schema, entry.table, rows);

    tableResults[key] = {
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.error ? [result.error] : [],
    };

    if (result.error) {
      // FK violation or other fatal error — report partial failure.
      return {
        status: "failed",
        dry_run: false,
        duration_ms: Date.now() - startMs,
        tables: tableResults,
        auth_users: authResult,
        error: `Insert failed at ${key}: ${result.error}`,
      };
    }
  }

  // ── 7. Update backup_snapshots.restored_at ────────────────────────────────
  await coreAdmin
    .from("backup_snapshots")
    .update({
      restored_at: new Date().toISOString(),
      restored_by: restoredBy ?? null,
    })
    .eq("id", snapshotId);

  return {
    status: "success",
    dry_run: false,
    duration_ms: Date.now() - startMs,
    tables: tableResults,
    auth_users: authResult,
  };
}
