# Tasks: org-granular-backup

> Generated: 2026-07-11
> Delivery: single-pr
> Total tasks: 14
> Parallelism: Tasks within the same phase can run in parallel; phases are sequential.

---

## Dependency Graph

```
Phase 1 (Migration + Constants)
  T-01  Migration: backup_snapshots table + org-backups bucket
  T-02  table-order.ts — FK/restore order constants   [requires: purge SQL read ✓]

Phase 2 (Core Executors)  — depends on T-01, T-02
  T-03  snapshot-builder.ts
  T-04  snapshot-restorer.ts

Phase 3 (API Routes)  — depends on T-03, T-04
  T-05  POST /api/admin/backups/run/route.ts
  T-06  GET  /api/admin/backups/route.ts
  T-07  POST /api/admin/backups/restore/route.ts
  T-08  GET  /api/cron/backup-orgs/route.ts (nightly trigger-all)

Phase 4 (Admin UI)  — depends on T-05, T-06, T-07
  T-09  BackupSnapshotTable.tsx component
  T-10  RestoreConfirmModal.tsx component
  T-11  /panel/backups/page.tsx
  T-12  Sidebar.tsx — add Backups nav item

Phase 5 (Scheduling)  — depends on T-08
  T-13  vercel.json — cron config

Phase 6 (Tests)  — depends on T-02, T-03, T-04
  T-14  Unit tests: table-order.ts + snapshot round-trip
```

---

## Phase 1 — Infrastructure (can start immediately)

### [x] T-01 — Migration: backup_snapshots table + org-backups bucket

**File**: `nodo-inmo/supabase/migrations/20260711000000_backup_snapshots.sql`
**Spec refs**: Domain 3 — backup_snapshots Table Schema; backup_snapshots RLS

**What to do**:
1. Create `nodo_core.backup_snapshots` table with exact schema:
   - `id uuid PK default gen_random_uuid()`
   - `org_id uuid NOT NULL REFERENCES shared.organizations(id)`
   - `nodo text NOT NULL CHECK (nodo IN ('nodo_inmo'))`
   - `snapshot_path text NOT NULL UNIQUE`
   - `row_counts jsonb NOT NULL`
   - `size_bytes bigint NOT NULL`
   - `status text NOT NULL CHECK (status IN ('completed', 'failed'))`
   - `error_message text`
   - `triggered_by text NOT NULL CHECK (triggered_by IN ('cron', 'manual'))`
   - `created_by uuid REFERENCES auth.users(id)`
   - `created_at timestamptz NOT NULL DEFAULT now()`
   - `restored_at timestamptz`
   - `restored_by uuid REFERENCES auth.users(id)`
2. Enable RLS on `nodo_core.backup_snapshots`
3. Policy: `service_role` can INSERT and UPDATE (bypass RLS)
4. Policy: SELECT for authenticated users whose `nodo_core.profiles.role` is `'admin'` or `'super_admin'`
5. Create Storage bucket `org-backups` (private, no public access) in nodo_core Supabase project

**Note**: The spec says `captured_at timestamptz NOT NULL` but the design interface uses `created_at`. Use `created_at` for the column (matches the design interface); `captured_at` is the JSON field inside the snapshot payload, not the DB column.

**Acceptance criteria**:
- Migration applies cleanly on a fresh nodo-inmo DB
- `INSERT` via service_role succeeds; `SELECT` as non-admin user returns empty set
- `SELECT` as admin-role user returns inserted rows
- Bucket `org-backups` exists in nodo_core Storage

---

### [x] T-02 — table-order.ts — FK dependency constants

**File**: `nodo-landing/lib/backup/table-order.ts`
**Spec refs**: Domain 1 — Snapshot Data Coverage; Domain 2 — FK-Ordered Restore
**Depends on**: Verified `purge_org_operational_data` delete order (already read — see below)

**Purge delete order** (from `nodo-inmo/supabase/migrations/20260620000000_purge_org_data.sql`):
```
cash_movements → property_expenses → owner_settlements → payments →
contract_guarantors → documents → reclamos → tasks → contracts →
properties → contacts → cash_accounts → conceptos → org_profiles →
shared.feedback → shared.org_members (non-admin only)
```

**What to do**:
Export two ordered arrays and a shared schema coverage type:

```typescript
// NODO_INMO_BACKUP_ORDER: SELECT order (parents first = reverse of purge delete)
// NODO_INMO_RESTORE_ORDER: INSERT order (same as backup order — parents before children)
// PURGE_COVERS_SHARED_FEEDBACK: boolean flag — purge deletes shared.feedback,
//   so backup MUST include it. (See open question in design.)
```

Backup/restore order (reverse of purge delete, parents first):
1. `shared.organizations`
2. `shared.org_members`  (ALL roles — not just non-admin; restore must be idempotent)
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
17. `shared.feedback`  (**include** — purge deletes it; backup must cover it)

Each entry: `{ schema: string; table: string; orgIdColumn: string }`.
`shared.user_profiles` is NOT a table in this DB — the org-member profile data lives in `nodo_core.profiles` (not backed up per-org) and `nodo_inmo.org_profiles` (already in list). Do NOT include `shared.user_profiles`.

**Acceptance criteria**:
- TypeScript compiles with no errors
- RESTORE_ORDER is the same array as BACKUP_ORDER (parents first = safe for insert)
- Array length is 17 (16 nodo_inmo/shared tables + shared.feedback)
- Each entry has `schema`, `table`, `orgIdColumn`

---

## Phase 2 — Core Executors (parallel, depends on T-01 + T-02)

### [x] T-03 — snapshot-builder.ts

**File**: `nodo-landing/lib/backup/snapshot-builder.ts`
**Spec refs**: Domain 1 — all requirements (Snapshot Data Coverage, JSON Format, Storage Path Convention, Metadata Registration)

**What to do**:
Implement `buildSnapshot(orgId: string, nodo: "nodo_inmo"): Promise<SnapshotResult>`:

1. Verify org exists in `shared.organizations` via `createNodoAdminClient("inmo")`. Return 404-style error if not found.
2. For each table in `NODO_INMO_BACKUP_ORDER`: paginated SELECT (1000 rows/batch) filtered by `org_id`. Accumulate into `tables` map keyed as `"{schema}.{table}"` (e.g. `"shared.organizations"`).
3. Fetch `auth.users` subset: only users who are members of the org. Use `nodoAdmin.auth.admin.listUsers()` then filter by IDs found in `shared.org_members`. Subset fields: `id`, `email`, `user_metadata`, `created_at`.
4. Assemble `OrgSnapshot` JSON (schema_version: 1).
5. Gzip compress the JSON (`zlib.gzipSync` or streaming equivalent).
6. Upload to `createAdminClient()` nodo_core Storage at path: `org-backups/{nodo}/{org_id}/{YYYY-MM-DDTHH:mm:ss}Z.json.gz`.
7. On upload success: INSERT into `nodo_core.backup_snapshots` with all metadata.
8. On upload failure: do NOT insert metadata row; return error.
9. Return `{ ok, snapshot_path, row_counts, size_bytes, duration_ms }`.

**Batch pagination pattern**: use `.range(offset, offset + 999)` loop until data length < 1000.

**Acceptance criteria**:
- Empty org produces snapshot with empty arrays and row_counts all zero
- Unknown org_id returns error without writing any file
- Storage path matches `org-backups/nodo_inmo/{org_id}/{timestamp}.json.gz`
- `backup_snapshots` row is inserted only after successful upload
- Upload failure leaves no metadata row

---

### [x] T-04 — snapshot-restorer.ts

**File**: `nodo-landing/lib/backup/snapshot-restorer.ts`
**Spec refs**: Domain 2 — all requirements (auth.users Handling, FK-Ordered Restore, Idempotent Restore, Restore Report)

**What to do**:
Implement `restoreSnapshot(snapshotId: string, dryRun?: boolean): Promise<RestoreReport>`:

1. Fetch `backup_snapshots` row by ID via `createAdminClient()`.
2. Download file from Storage at `snapshot_path`.
3. Gunzip + JSON parse into `OrgSnapshot`.
4. For each user in `auth_users`: check existence via `nodoAdmin.auth.admin.getUserById(id)`. If missing, call `auth.admin.createUser({ id, email, user_metadata, email_confirm: true })`. Collect `created`/`skipped`/`errors`.
5. If any user re-creation fails and `!dryRun`: abort with `status: "failed"`.
6. For each table in `NODO_INMO_RESTORE_ORDER`:
   - Use `createNodoAdminClient("inmo")`
   - `INSERT INTO {schema}.{table} SELECT * FROM jsonb_populate_recordset(null::{table}, $1) ON CONFLICT (id) DO NOTHING`
   - Collect `inserted` (rows affected), `skipped` (conflict), `errors`.
7. If `dryRun`: skip writes, still return simulated report with row counts from snapshot data.
8. On completion: UPDATE `backup_snapshots.restored_at = now()`, `restored_by = userId`.
9. Return full `RestoreReport` per spec.

**Note on dry_run**: for true dry-run simulation, return snapshot row counts as `inserted` and 0 `skipped`, clearly flagged with `dry_run: true` in the response.

**Acceptance criteria**:
- Restoring same snapshot twice yields identical state (no errors on second run)
- Missing auth.users are re-created before any table insert
- FK violation does not occur when inserting in NODO_INMO_RESTORE_ORDER
- `dry_run: true` returns report without any DB mutation
- `restored_at` is set on the `backup_snapshots` row after successful restore

---

## Phase 3 — API Routes (parallel, depends on T-03 + T-04)

### [x] T-05 — POST /api/admin/backups/run/route.ts

**File**: `nodo-landing/app/api/admin/backups/run/route.ts`
**Spec refs**: Domain 3 — Manual Backup Trigger API; Domain 4 — Cron Authentication

**What to do**:
- Accept `POST { org_id: string, nodo: "nodo_inmo" }`
- Auth: `requirePanelTeamMember()` OR verify `Authorization: Bearer {CRON_SECRET}` header (to allow cron calls without a session)
- Validate `org_id` (UUID format) and `nodo` (must be `"nodo_inmo"`)
- Call `buildSnapshot(org_id, nodo)`
- Return `{ ok: true, snapshot_path, row_counts, size_bytes, duration_ms }` or error

**Note**: The spec names this endpoint `POST /api/admin/backups/trigger` but the design file uses `/run`. Use `/run` (matches design file manifest).

**Acceptance criteria**:
- Valid panel member or valid CRON_SECRET can trigger
- Unauthenticated request returns 401
- Unknown org_id returns 404 with `"org not found"`
- Success returns snapshot metadata

---

### [x] T-06 — GET /api/admin/backups/route.ts

**File**: `nodo-landing/app/api/admin/backups/route.ts`
**Spec refs**: Domain 3 — Snapshot List API

**What to do**:
- Accept `GET ?org_id=&nodo=&page=&limit=`
- Auth: `requirePanelTeamMember()`
- Query `nodo_core.backup_snapshots` via `createAdminClient()` with optional filters
- Default: `ORDER BY created_at DESC`, `limit` default 20
- Return: `{ ok: true, data: BackupSnapshot[], total: number, page: number }`
- Fields returned per row: `id, org_id, nodo, created_at, row_counts, size_bytes, restored_at, status, triggered_by`

**Acceptance criteria**:
- Unauthenticated returns 401
- Without filters: all snapshots returned ordered by `created_at DESC`
- With `?org_id=X`: only org X snapshots returned
- Pagination respected (`limit`, `page`)

---

### [x] T-07 — POST /api/admin/backups/restore/route.ts

**File**: `nodo-landing/app/api/admin/backups/restore/route.ts`
**Spec refs**: Domain 2 — Restore Trigger Authorization; Domain 3 — Restore Initiation API

**What to do**:
- Accept `POST { snapshot_id: string, dry_run?: boolean }`
- Auth: `requirePanelAdmin()` (stricter — admin role required)
- Validate `snapshot_id` (UUID)
- Call `restoreSnapshot(snapshot_id, dry_run)`
- Return full `RestoreReport`

**Acceptance criteria**:
- Non-admin team member returns 403
- Unauthenticated returns 401
- `dry_run: true` returns report with no mutations
- Unknown `snapshot_id` returns 404
- Successful restore returns `{ status: "success", duration_ms, tables: {...}, auth_users: {...} }`

---

### [x] T-08 — GET /api/cron/backup-orgs/route.ts

**File**: `nodo-landing/app/api/cron/backup-orgs/route.ts`
**Spec refs**: Domain 4 — all requirements (Nightly Cron Schedule, Per-Org Isolation, Nightly Run Summary, Cron Authentication, Active Org Selection)

**What to do**:
- Accept `GET` (Vercel Cron uses GET)
- Auth: verify `Authorization: Bearer {CRON_SECRET}` header; return 401 if missing/wrong
- Query `shared.organizations` via `createNodoAdminClient("inmo")` where `is_active = true` and `product = 'inmo'`
- For each active org: call `buildSnapshot(org.id, "nodo_inmo")` sequentially (avoid concurrent timeouts)
- Per-org failure must NOT stop other orgs (catch error, log, continue)
- Collect `{ attempted, succeeded, failed, errors: [{ org_id, error }] }`
- Return summary JSON + log it

**Acceptance criteria**:
- Missing/wrong CRON_SECRET returns 401
- Inactive org (`is_active = false`) is not backed up and not counted in failures
- One org error does not prevent other orgs from running
- Summary includes attempted/succeeded/failed counts and per-org error details

---

## Phase 4 — Admin UI (parallel, depends on T-05 + T-06 + T-07)

### [x] T-09 — BackupSnapshotTable.tsx

**File**: `nodo-landing/components/panel/BackupSnapshotTable.tsx`
**Spec refs**: Domain 3 — Admin Panel Backup UI

**What to do**:
Client component that:
- Accepts `snapshots: BackupSnapshot[]` prop
- Renders table with columns: org_id (truncated), nodo, created_at (formatted), row_counts summary (total rows), size_bytes (human readable KB/MB), restored_at (or "—"), status badge
- "Backup Now" button per row → calls `POST /api/admin/backups/run` → shows loading state → refreshes list on success
- "Restore" button per row → opens `RestoreConfirmModal`
- Shows inline result after restore completes (per-table counts + duration + status)

**Acceptance criteria**:
- Renders without crashing when `snapshots` is empty
- "Backup Now" button shows loading state during fetch
- Restore button opens confirmation modal before any API call

---

### [x] T-10 — RestoreConfirmModal.tsx

**File**: `nodo-landing/components/panel/RestoreConfirmModal.tsx`
**Spec refs**: Domain 3 — Restore confirmation required scenario

**What to do**:
Modal component:
- Props: `snapshot: BackupSnapshot | null`, `onConfirm(snapshotId: string, dryRun: boolean): void`, `onClose(): void`
- Shows snapshot details: org_id, created_at, row_counts summary
- "Dry Run" checkbox (default unchecked)
- Confirm button triggers `onConfirm`; Cancel closes modal
- Disabled confirm button while restore is in progress

**Acceptance criteria**:
- Modal does not call API unless user explicitly clicks Confirm
- Dry run checkbox state is passed through to `onConfirm`

---

### [x] T-11 — /panel/backups/page.tsx

**File**: `nodo-landing/app/panel/backups/page.tsx`
**Spec refs**: Domain 3 — Admin Panel Backup UI

**What to do**:
Server component (Next.js page):
- Fetch initial snapshot list from `GET /api/admin/backups` at render time (or use server-side Supabase query directly)
- Render `<BackupSnapshotTable snapshots={...} />`
- Page title: "Backups"
- Require panel team member access (redirect to `/login` if not authenticated); use existing panel layout

**Acceptance criteria**:
- Page renders with SSR snapshot list
- Unauthenticated user is redirected

---

### [x] T-12 — Sidebar.tsx — add Backups nav item

**File**: `nodo-landing/components/panel/Sidebar.tsx`
**Spec refs**: Domain 3 — Admin Panel Backup UI

**What to do**:
Add to `PLATFORM_ITEMS` array:
```typescript
{ label: "Backups", href: "/panel/backups", icon: DatabaseBackup },
```
Import `DatabaseBackup` from `lucide-react` (verify it exists in the installed version; fallback: `HardDrive` or `ArchiveRestore`).

**Acceptance criteria**:
- "Backups" item appears in sidebar navigation
- Active state highlights correctly when on `/panel/backups`

---

## Phase 5 — Scheduling (depends on T-08)

### [x] T-13 — vercel.json cron config

**File**: `nodo-landing/vercel.json`  (new file — does not currently exist)
**Spec refs**: Domain 4 — Nightly Cron Schedule

**What to do**:
```json
{
  "crons": [
    {
      "path": "/api/cron/backup-orgs",
      "schedule": "0 4 * * *"
    }
  ]
}
```

Note: Design uses `0 4 * * *` (04:00 UTC); spec says `0 2 * * *` (02:00 UTC). **Use `0 2 * * *`** to match the spec requirement. Raise in PR review if there's intent to shift the time.

**Acceptance criteria**:
- `vercel.json` is valid JSON
- Schedule field is `"0 2 * * *"`
- Path matches the cron route created in T-08

---

## Phase 6 — Tests (parallel with Phase 4+5, depends on T-02, T-03, T-04)

### [x] T-14 — Unit tests

**Files**:
- `nodo-landing/lib/backup/__tests__/table-order.test.ts`
- `nodo-landing/lib/backup/__tests__/snapshot-builder.test.ts`
- `nodo-landing/lib/backup/__tests__/snapshot-restorer.test.ts`

**Spec refs**: Design — Testing Strategy (Unit layer)

**What to do**:
Using Vitest + mocked Supabase client:

1. **table-order.test.ts**:
   - `NODO_INMO_BACKUP_ORDER` and `NODO_INMO_RESTORE_ORDER` are the same array (or RESTORE_ORDER is backup-compatible)
   - Array has 17 entries
   - `shared.organizations` is first, `shared.feedback` is last
   - `cash_movements` is second-to-last (before feedback)

2. **snapshot-builder.test.ts**:
   - Unknown org_id returns error, no upload called
   - Empty org: snapshot has empty arrays, row_counts all zero
   - Upload failure: no metadata INSERT called
   - Snapshot JSON structure matches `OrgSnapshot` interface (schema_version: 1, all keys present)
   - Gzip round-trip: compress then decompress returns identical JSON

3. **snapshot-restorer.test.ts**:
   - `dry_run: true`: no Supabase INSERT or auth.admin.createUser calls
   - Missing auth users trigger `createUser` before table inserts
   - `createUser` failure in non-dry-run returns `status: "failed"` with no table inserts
   - Idempotency: inserting same rows twice returns no errors (mocked DO NOTHING behavior)

**Acceptance criteria**:
- All tests pass with `vitest run`
- No real Supabase network calls in unit tests

---

## Open Questions (carry forward from design)

1. **shared.feedback**: Purge deletes it; T-02 resolves this by including it in the backup order. Confirm with team before T-03 implementation — if feedback should NOT be backed up, remove from `NODO_INMO_BACKUP_ORDER`.

2. **user_profiles table**: Design mentions `shared.user_profiles` but this table does NOT exist in the nodo-inmo DB. Profile data is in `nodo_core.profiles` (not org-scoped) and `nodo_inmo.org_profiles` (already included). The `auth_users` subset in the snapshot covers the user identity. No additional action needed unless team confirms otherwise.

3. **Spec vs design schedule conflict**: Spec says `0 2 * * *`, design says `0 4 * * *`. T-13 uses spec (`0 2 * * *`) — flag in PR.

4. **DatabaseBackup icon**: Verify `lucide-react` version in nodo-landing has this icon. If not, use `HardDrive` as fallback.

---

## Review Workload Forecast

| Metric | Estimate |
|--------|----------|
| New files | 13 |
| Modified files | 1 (Sidebar.tsx) |
| Estimated lines changed | ~750–1000 |
| 400-line budget risk | **High** |
| Chained PRs recommended | No (single-pr delivery, scoped to nodo-landing + 1 migration) |
| Decision needed before apply | No — single-pr confirmed |
| Bottleneck | T-03/T-04 are the critical path; everything else unblocks once they're done |
| Unclear ownership | Open question on `shared.feedback` inclusion (T-02 / T-03) — needs team decision before T-03 ships |

Since delivery strategy is `single-pr` and the scope is self-contained (one new nodo-landing feature + one additive migration), the size exception is acceptable. All 13 new files are cohesive and the PR will be reviewable as a unit.
