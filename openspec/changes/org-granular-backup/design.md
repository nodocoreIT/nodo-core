# Design: Per-Org Granular Backup System

## Technical Approach

API-route-first architecture: backup and restore run as Next.js Route Handlers in nodo-landing (not Edge Functions), using `createNodoAdminClient()` to reach each nodo's Supabase project and `createAdminClient()` for nodo_core metadata. This matches the existing `purge-nodo-data` pattern exactly. Vercel Cron triggers the backup route nightly. Admin UI lives under `/panel/backups`.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Execution runtime | Next.js API Routes (nodo-landing) | Supabase Edge Functions | Edge Functions run on nodo-inmo's Supabase project, but backup needs cross-project access (nodo-inmo data + nodo_core metadata + nodo_core Storage). API routes already have `createNodoAdminClient()` and `createAdminClient()` wired. The purge flow uses this exact pattern. |
| Storage location | nodo_core Supabase Storage (`org-backups` bucket) | nodo-inmo Storage | Backups are a platform concern, not a nodo concern. nodo_core owns the metadata table and should own the files. Single bucket simplifies RLS and lifecycle. |
| Serialization format | Single JSON file per snapshot, gzip-compressed | JSONL, per-table files | Under 50MB per org (typical). Single file = atomic download/restore. Gzip cuts size 5-10x. Split by table deferred to v2 if needed. |
| Restore conflict strategy | `ON CONFLICT DO NOTHING` | `ON CONFLICT DO UPDATE`, error-on-conflict | Idempotency is a stated success criterion. DO NOTHING is safe for re-runs. If data already exists with same PK, it was either not deleted or already restored. |
| Timeout mitigation | Vercel 300s function timeout + paginated SELECTs (1000 rows/batch) | Streaming, background jobs | 300s is generous for typical org sizes (<10k rows total). Pagination avoids memory spikes. If an org exceeds this, it surfaces as an error and gets handled manually (v2: queue-based). |
| Auth for cron | `CRON_SECRET` header check | Service role JWT, no auth | Vercel Cron sends a secret via `Authorization: Bearer <CRON_SECRET>`. Simple, standard pattern. |
| Backup metadata | `nodo_core.backup_snapshots` table | File naming convention only | Queryable history, row counts, status tracking, UI needs a fast list endpoint. |

## Data Flow

```
Vercel Cron (nightly)
    |
    v
POST /api/admin/backups/run  [nodo-landing Route Handler]
    |
    +-- requirePanelTeamMember() OR verify CRON_SECRET
    |
    +-- createNodoAdminClient("inmo")  -->  SELECT from nodo_inmo tables (FK order)
    |                                       SELECT from shared.* (org, members, profiles)
    |                                       supabase.auth.admin.listUsers() (subset by org member IDs)
    |
    +-- Assemble JSON snapshot { schema_version, nodo, org_id, timestamp, auth_users[], tables{} }
    |
    +-- gzip compress
    |
    +-- createAdminClient("nodo_core") --> Storage.upload("org-backups/{nodo}/{org_id}/{iso}.json.gz")
    |                                      INSERT INTO backup_snapshots (metadata row)
    |
    v
  Response: { ok, snapshot_path, row_counts, duration_ms }
```

Restore flow:

```
POST /api/admin/backups/restore  [nodo-landing Route Handler]
    |
    +-- requirePanelAdmin()
    |
    +-- createAdminClient() --> Storage.download(snapshot_path) --> gunzip --> parse JSON
    |
    +-- For each auth_user in snapshot:
    |     supabase.auth.admin.getUserById(id)
    |     if not found: supabase.auth.admin.createUser({ id, email, user_metadata })
    |
    +-- createNodoAdminClient("inmo") --> postgres direct connection
    |     INSERT in reverse-purge order (org_profiles -> conceptos -> ... -> cash_movements)
    |     Each INSERT uses ON CONFLICT (id) DO NOTHING
    |
    v
  Response: { ok, per_table_counts, skipped_counts, duration_ms, errors[] }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `nodo-landing/app/api/admin/backups/run/route.ts` | Create | POST handler: backup one org for one nodo. Accepts `{ nodo, org_id }`. Cron calls this per-org. |
| `nodo-landing/app/api/admin/backups/route.ts` | Create | GET handler: list snapshots from `backup_snapshots` table, filtered by nodo/org_id. |
| `nodo-landing/app/api/admin/backups/restore/route.ts` | Create | POST handler: restore from a snapshot path. Admin-only. |
| `nodo-landing/app/api/cron/backup-orgs/route.ts` | Create | GET handler for Vercel Cron. Verifies `CRON_SECRET`, iterates active orgs, calls backup logic per org. |
| `nodo-landing/lib/backup/snapshot-builder.ts` | Create | Core backup logic: query tables in FK order, fetch auth.users subset, assemble JSON, compress, upload. |
| `nodo-landing/lib/backup/snapshot-restorer.ts` | Create | Core restore logic: download, decompress, restore auth.users, insert tables in reverse-purge order. |
| `nodo-landing/lib/backup/table-order.ts` | Create | FK-dependency order constants derived from `purge_org_operational_data`. Export `NODO_INMO_BACKUP_ORDER` and `NODO_INMO_RESTORE_ORDER`. |
| `nodo-landing/app/panel/backups/page.tsx` | Create | Admin panel page: snapshot list table, Backup Now button, Restore button with confirmation modal. |
| `nodo-landing/components/panel/BackupSnapshotTable.tsx` | Create | Client component: lists snapshots with status, row counts, download/restore actions. |
| `nodo-landing/components/panel/RestoreConfirmModal.tsx` | Create | Confirmation modal for restore action (type org name to confirm). |
| `nodo-landing/components/panel/Sidebar.tsx` | Modify | Add "Backups" nav item to `PLATFORM_ITEMS` array. |
| `nodo-landing/vercel.json` | Create | Cron config: `{ "crons": [{ "path": "/api/cron/backup-orgs", "schedule": "0 4 * * *" }] }`. |
| `nodo-inmo/supabase/migrations/YYYYMMDD_backup_snapshots.sql` | Create | `nodo_core.backup_snapshots` DDL + RLS + `org-backups` Storage bucket creation. |

## Interfaces / Contracts

```typescript
// Snapshot JSON schema (schema_version: 1)
interface OrgSnapshot {
  schema_version: 1;
  nodo: "nodo_inmo";
  org_id: string;
  created_at: string; // ISO 8601
  auth_users: Array<{ id: string; email: string; user_metadata: Record<string, unknown> }>;
  shared: {
    organizations: Row[];
    org_members: Row[];
    user_profiles: Row[];
  };
  tables: Record<string, Row[]>; // keyed by table name (e.g. "contacts", "properties")
  row_counts: Record<string, number>;
}

// backup_snapshots table
interface BackupSnapshot {
  id: uuid;
  nodo: string;
  org_id: uuid;
  snapshot_path: string;        // Storage path
  row_counts: jsonb;
  size_bytes: bigint;
  status: "completed" | "failed";
  error_message: text | null;
  triggered_by: "cron" | "manual";
  created_by: uuid | null;      // user who triggered (null for cron)
  created_at: timestamptz;
}
```

**Storage path convention**: `org-backups/{nodo}/{org_id}/{YYYY-MM-DDTHH:mm:ss}Z.json.gz`

**nodo_inmo backup order** (SELECT order, derived from purge reverse):

1. `shared.organizations` (the org row itself)
2. `shared.org_members` (all members, not just non-admin)
3. `nodo_inmo.org_profiles`
4. `nodo_inmo.conceptos`
5. `nodo_inmo.cash_accounts`
6. `nodo_inmo.contacts`
7. `nodo_inmo.properties`
8. `nodo_inmo.contracts`
9. `nodo_inmo.tasks`
10. `nodo_inmo.reclamos`
11. `nodo_inmo.documents`
12. `nodo_inmo.contract_guarantors`
13. `nodo_inmo.payments`
14. `nodo_inmo.owner_settlements`
15. `nodo_inmo.property_expenses`
16. `nodo_inmo.cash_movements`

**Restore order**: same as above (parent tables first). This is the REVERSE of the purge delete order.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `table-order.ts` constants, JSON assembly, gzip round-trip | Vitest, mock Supabase client |
| Integration | Full backup + restore cycle on a test org | Seed test data, backup, purge, restore, verify row counts match |
| Manual | Cron trigger, admin UI flows | Vercel preview deploy + manual execution |

## Migration / Rollout

1. Deploy migration: `backup_snapshots` table + `org-backups` bucket (additive, zero risk)
2. Deploy API routes + lib (no UI yet, test via curl)
3. Deploy admin UI + sidebar link
4. Deploy `vercel.json` cron config (activates nightly backups)

Phases are independently deployable. Rollback = revert deploy + drop table/bucket.

## Open Questions

- [ ] Should `shared.feedback` rows (org-scoped) be included in the backup? Purge deletes them, so restore should probably include them.
- [ ] What `user_profiles` table is referenced? Need to verify if it's `shared.user_profiles` or `nodo_core.profiles` -- the snapshot needs whichever stores org-member profile data.
