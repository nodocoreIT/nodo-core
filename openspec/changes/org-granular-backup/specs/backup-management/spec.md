# backup-management Specification

## Purpose

Defines requirements for the admin panel UI and API routes that expose backup history, manual trigger, and restore initiation for org-level snapshots.

## Requirements

### Requirement: backup_snapshots Table Schema

The system MUST maintain a `nodo_core.backup_snapshots` table with the following schema:

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
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

- GIVEN a successful backup run
- WHEN the Edge Function completes
- THEN a row is inserted into `backup_snapshots` with all non-nullable columns populated

---

### Requirement: backup_snapshots RLS

Only service_role MAY INSERT or UPDATE rows. Admin users (role `admin` or `super_admin`) MAY SELECT all rows. Regular users MUST NOT access this table.

#### Scenario: Admin reads snapshot list

- GIVEN an authenticated admin user
- WHEN they query `backup_snapshots`
- THEN they receive all rows

#### Scenario: Non-admin blocked

- GIVEN an authenticated user without admin role
- WHEN they query `backup_snapshots`
- THEN they receive an empty result set (RLS filters all rows)

---

### Requirement: Snapshot List API

`GET /api/admin/backups` MUST return a paginated list of snapshots, optionally filtered by `org_id` or `nodo`. Response MUST include: `id`, `org_id`, `nodo`, `captured_at`, `row_counts`, `size_bytes`, `restored_at`.

#### Scenario: List all snapshots

- GIVEN snapshots exist for multiple orgs
- WHEN admin calls `GET /api/admin/backups`
- THEN all snapshots are returned ordered by `captured_at DESC`

#### Scenario: Filter by org_id

- GIVEN snapshots for org A and org B
- WHEN admin calls `GET /api/admin/backups?org_id={org_a}`
- THEN only org A snapshots are returned

---

### Requirement: Manual Backup Trigger API

`POST /api/admin/backups/trigger` MUST accept `{ org_id, nodo }`, call the `backup-org-snapshot` Edge Function synchronously, and return the new snapshot metadata or an error.

#### Scenario: Successful manual trigger

- GIVEN a valid `org_id` and `nodo`
- WHEN admin POSTs to `/api/admin/backups/trigger`
- THEN the Edge Function runs, a snapshot is created, and the new metadata row is returned

#### Scenario: Trigger with invalid org_id

- GIVEN an `org_id` that does not exist
- WHEN admin POSTs to trigger
- THEN a 404 error is returned with `"org not found"` message

---

### Requirement: Restore Initiation API

`POST /api/admin/backups/restore` MUST accept `{ snapshot_id, dry_run? }`, call `restore-org-snapshot`, and return the restore report. The `dry_run` flag MUST cause the function to validate and report without committing.

#### Scenario: Restore with dry_run

- GIVEN a valid `snapshot_id`
- WHEN admin POSTs with `dry_run: true`
- THEN the restore report is returned without any data mutations

---

### Requirement: Admin Panel Backup UI

The admin panel MUST include a backup management page at `/panel/backups` with:

- A snapshot list table showing: `org_id`, `nodo`, `captured_at`, `row_counts` (summary), `size_bytes`, `restored_at`
- A "Backup Now" button per org that calls the trigger API
- A "Restore" button per snapshot that opens a confirmation dialog before calling the restore API
- A progress/status indicator during backup or restore operations
- A result report displayed inline after restore completes

#### Scenario: Restore confirmation required

- GIVEN an admin viewing the backup list
- WHEN they click "Restore" on a snapshot
- THEN a confirmation dialog appears with snapshot details before the restore API is called

#### Scenario: Restore result shown inline

- GIVEN a restore operation completes
- WHEN the result is returned from the API
- THEN the per-table row counts, duration, and status are displayed in the panel without page reload
