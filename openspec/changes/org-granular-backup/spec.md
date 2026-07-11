# Spec: org-granular-backup

> Canonical domain specs live in the nodocore monorepo at `openspec/changes/org-granular-backup/specs/`.
> This file contains the full consolidated spec for cross-repo reference.

---

## Domain 1 — org-backup-snapshot

### Requirement: Snapshot Data Coverage

The Edge Function MUST capture all tables listed below for the target `org_id`:

| Schema | Tables |
|--------|--------|
| `shared` | `organizations`, `org_members`, `user_profiles` |
| `nodo_inmo` | All 15 tables partitioned by `org_id` (FK dependency order) |
| `auth` | `users` subset: `id`, `email`, `user_metadata`, `created_at` — only org members |

The function MUST NOT capture rows from other orgs.

#### Scenario: Full org snapshot

- GIVEN a valid `org_id` with data across `shared` and `nodo_inmo`
- WHEN `backup-org-snapshot` is invoked
- THEN all rows filtered by `org_id` and the matching `auth.users` subset are included

#### Scenario: Empty org

- GIVEN a valid `org_id` with no operational data
- WHEN `backup-org-snapshot` is invoked
- THEN the snapshot is created with empty arrays and `row_counts` all zero

#### Scenario: Unknown org_id

- GIVEN an `org_id` not in `shared.organizations`
- WHEN `backup-org-snapshot` is invoked
- THEN a 404 is returned and no snapshot is written

---

### Requirement: Snapshot JSON Format

Every snapshot MUST conform to:

```json
{
  "schema_version": 1,
  "org_id": "<uuid>",
  "nodo": "nodo_inmo",
  "captured_at": "<ISO 8601 UTC>",
  "tables": { "<schema.table_name>": [ ...rows ] },
  "auth_users": [ ...user subset rows ]
}
```

`schema_version` MUST be `1`. `captured_at` MUST be UTC serialization-start time. Table keys MUST use `{schema}.{table}`.

#### Scenario: Format compliance

- GIVEN a completed serialization run
- WHEN the JSON is parsed
- THEN it contains all required top-level keys and `schema_version` equals `1`

---

### Requirement: Storage Path Convention

Snapshots MUST be uploaded to bucket `org-backups` at path:

```
{nodo}/{org_id}/{iso_timestamp}.json
```

#### Scenario: Path uniqueness

- GIVEN two backup runs for the same org at different times
- WHEN both are uploaded
- THEN they occupy distinct storage paths

---

### Requirement: Metadata Registration

After a successful upload, the function MUST insert a row into `nodo_core.backup_snapshots` with `org_id`, `nodo`, `snapshot_path`, `row_counts`, `captured_at`, `size_bytes`.

#### Scenario: Successful backup metadata

- GIVEN a snapshot upload succeeds
- WHEN the function completes
- THEN a row in `backup_snapshots` matches the snapshot path with correct row counts

#### Scenario: Upload fails

- GIVEN a Storage upload error
- WHEN the function encounters it
- THEN no metadata row is written and the error is returned

---

## Domain 2 — org-restore-snapshot

### Requirement: Restore Trigger Authorization

Only admin users MAY trigger a restore. Calls without a valid service_role or admin JWT MUST be rejected with 401.

#### Scenario: Unauthorized restore attempt

- GIVEN a request without a valid admin/service_role token
- WHEN `restore-org-snapshot` is called
- THEN 401 is returned and no data is mutated

---

### Requirement: auth.users Handling

Before any data insert, the function MUST check for each user in the snapshot. Missing users MUST be re-created via `supabase.auth.admin.createUser` preserving original UUID, email, and `user_metadata`.

#### Scenario: auth.users already exist

- GIVEN all users exist in `auth.users`
- WHEN restore runs
- THEN no new auth users are created

#### Scenario: auth.users missing

- GIVEN one or more snapshot users are absent from `auth.users`
- WHEN restore runs
- THEN each missing user is re-created before data insert

#### Scenario: Re-creation fails

- GIVEN `auth.admin.createUser` errors for a user
- WHEN restore runs
- THEN the transaction is rolled back and the error is reported

---

### Requirement: FK-Ordered Restore

Tables MUST be restored in the exact reverse of `purge_org_operational_data()` delete order (anchor tables first for insert, leaf tables last). `shared.organizations` and `shared.org_members` MUST be inserted before any `nodo_inmo` table.

#### Scenario: Correct insert order

- GIVEN a full snapshot
- WHEN restore runs
- THEN no FK RESTRICT violation occurs

#### Scenario: FK violation detected

- GIVEN an incorrect order reaching a FK constraint
- WHEN the transaction hits the violation
- THEN it rolls back and identifies the offending table

---

### Requirement: Idempotent Restore

All inserts MUST use `INSERT … ON CONFLICT (id) DO NOTHING`. Running the same restore twice MUST yield the same state.

#### Scenario: Duplicate restore

- GIVEN a completed restore
- WHEN the same snapshot is restored again
- THEN row counts are unchanged and no error is returned

---

### Requirement: Restore Report

On completion, the function MUST return:

| Field | Description |
|-------|-------------|
| `status` | `success` \| `partial` \| `failed` |
| `duration_ms` | Wall-clock duration |
| `tables` | `{ table → { inserted, skipped, errors } }` |
| `auth_users` | `{ created, skipped, errors }` |
| `error` | Error message when not `success` |

#### Scenario: Successful restore report

- GIVEN a restore with no errors
- WHEN it completes
- THEN `status` is `success` and each table shows correct `inserted` counts

#### Scenario: Failure report

- GIVEN a restore that rolls back
- WHEN it returns
- THEN `status` is `failed` and `error` describes the root cause

---

## Domain 3 — backup-management

### Requirement: backup_snapshots Table Schema

`nodo_core.backup_snapshots` MUST have:

| Column | Type | Constraint |
|--------|------|-----------|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `org_id` | `uuid` | NOT NULL, FK → `shared.organizations.id` |
| `nodo` | `text` | NOT NULL, CHECK IN ('nodo_inmo') |
| `snapshot_path` | `text` | NOT NULL, UNIQUE |
| `row_counts` | `jsonb` | NOT NULL |
| `size_bytes` | `bigint` | NOT NULL |
| `captured_at` | `timestamptz` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `restored_at` | `timestamptz` | NULLABLE |
| `restored_by` | `uuid` | NULLABLE, FK → `auth.users.id` |

#### Scenario: Metadata row created on backup

- GIVEN a successful backup
- WHEN the Edge Function completes
- THEN a row is inserted with all non-nullable columns populated

---

### Requirement: backup_snapshots RLS

service_role MAY INSERT/UPDATE. Admin users (role `admin` or `super_admin`) MAY SELECT. All other users MUST NOT read this table.

#### Scenario: Admin reads list

- GIVEN an authenticated admin user
- WHEN they query `backup_snapshots`
- THEN all rows are returned

#### Scenario: Non-admin blocked

- GIVEN a non-admin authenticated user
- WHEN they query `backup_snapshots`
- THEN RLS returns an empty set

---

### Requirement: Snapshot List API

`GET /api/admin/backups` MUST return paginated snapshots optionally filtered by `org_id` or `nodo`, ordered by `captured_at DESC`. Response includes `id`, `org_id`, `nodo`, `captured_at`, `row_counts`, `size_bytes`, `restored_at`.

#### Scenario: List all snapshots

- GIVEN snapshots for multiple orgs
- WHEN admin calls `GET /api/admin/backups`
- THEN all are returned ordered by `captured_at DESC`

#### Scenario: Filter by org_id

- GIVEN snapshots for org A and org B
- WHEN admin calls with `?org_id={org_a}`
- THEN only org A snapshots are returned

---

### Requirement: Manual Backup Trigger API

`POST /api/admin/backups/trigger` MUST accept `{ org_id, nodo }`, invoke `backup-org-snapshot`, and return the new snapshot metadata or an error.

#### Scenario: Successful manual trigger

- GIVEN valid `org_id` and `nodo`
- WHEN admin POSTs
- THEN the function runs and new metadata is returned

#### Scenario: Invalid org_id

- GIVEN an org_id that does not exist
- WHEN admin POSTs
- THEN 404 is returned with `"org not found"`

---

### Requirement: Restore Initiation API

`POST /api/admin/backups/restore` MUST accept `{ snapshot_id, dry_run? }`, call `restore-org-snapshot`, and return the restore report. `dry_run: true` MUST validate without committing.

#### Scenario: Restore with dry_run

- GIVEN a valid `snapshot_id`
- WHEN admin POSTs with `dry_run: true`
- THEN the report is returned without mutations

---

### Requirement: Admin Panel Backup UI

The admin panel MUST expose `/panel/backups` with:
- Snapshot list: `org_id`, `nodo`, `captured_at`, `row_counts` summary, `size_bytes`, `restored_at`
- "Backup Now" button per org (calls trigger API)
- "Restore" button per snapshot (opens confirmation dialog before API call)
- Progress/status indicator during operations
- Inline result report after restore

#### Scenario: Restore confirmation required

- GIVEN an admin clicks "Restore"
- WHEN the button is pressed
- THEN a confirmation dialog with snapshot details appears before the restore API is called

#### Scenario: Result shown inline

- GIVEN a restore completes
- WHEN the API returns
- THEN per-table counts, duration, and status display without page reload

---

## Domain 4 — backup-scheduling

### Requirement: Nightly Cron Schedule

A Vercel Cron job MUST trigger at **02:00 UTC** daily (`0 2 * * *`) by calling `POST /api/admin/backups/trigger-all` in nodo-landing.

#### Scenario: Nightly trigger fires

- GIVEN the cron configured at `0 2 * * *` UTC
- WHEN 02:00 UTC passes
- THEN the API route is invoked and all active `nodo_inmo` orgs are backed up

---

### Requirement: Per-Org Isolation

A failure for one org MUST NOT prevent other orgs from being backed up.

#### Scenario: One org fails during nightly run

- GIVEN org A causes an Edge Function error
- WHEN the nightly run processes org A then org B
- THEN org B's snapshot is still created and org A's error is logged

---

### Requirement: Nightly Run Summary

After all orgs are processed, the route MUST log and return: total attempted, succeeded, failed, and per-org error details.

#### Scenario: Summary content

- GIVEN 10 orgs with 1 failure
- WHEN the run completes
- THEN summary shows `attempted: 10`, `succeeded: 9`, `failed: 1`, and the failing org's error

---

### Requirement: Cron Authentication

`/api/admin/backups/trigger-all` MUST require `Authorization: Bearer {CRON_SECRET}`. Requests without a valid secret MUST return 401.

#### Scenario: Valid secret

- GIVEN a request with the correct `CRON_SECRET`
- WHEN the route is hit
- THEN the backup run proceeds

#### Scenario: Missing or invalid secret

- GIVEN a request without or with wrong secret
- WHEN the route is hit
- THEN 401 is returned and no backup runs

---

### Requirement: Active Org Selection

The nightly run MUST only back up orgs where `shared.organizations.is_active = true`. Inactive orgs MUST be skipped without counting as failures.

#### Scenario: Inactive org skipped

- GIVEN an org with `is_active = false`
- WHEN the nightly backup runs
- THEN no snapshot is created for that org and it is not counted in failures
