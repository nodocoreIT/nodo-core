# org-backup-snapshot Specification

## Purpose

Defines requirements for the Edge Function that serializes one org's data from `nodo_inmo` and `shared` schemas (plus the relevant `auth.users` subset) into a versioned JSON snapshot and uploads it to Supabase Storage.

## Requirements

### Requirement: Snapshot Data Coverage

The Edge Function MUST capture all tables listed below for the target `org_id`:

| Schema | Tables |
|--------|--------|
| `shared` | `organizations`, `org_members`, `user_profiles` |
| `nodo_inmo` | All 15 tables partitioned by `org_id` (in FK dependency order) |
| `auth` | `users` subset: `id`, `email`, `user_metadata`, `created_at` — only users belonging to the org |

The function MUST NOT capture rows from other orgs.

#### Scenario: Full org snapshot

- GIVEN a valid `org_id` with data across `shared` and `nodo_inmo`
- WHEN `backup-org-snapshot` is invoked with that `org_id`
- THEN rows from all tables filtered by `org_id` are included in the snapshot
- AND `auth.users` rows matching the org's members are included

#### Scenario: Empty org

- GIVEN a valid `org_id` with no operational data
- WHEN `backup-org-snapshot` is invoked
- THEN the snapshot is created with empty arrays per table and `row_counts` all zero

#### Scenario: Unknown org_id

- GIVEN an `org_id` that does not exist in `shared.organizations`
- WHEN `backup-org-snapshot` is invoked
- THEN the function returns a 404 error and no snapshot is written to Storage

---

### Requirement: Snapshot JSON Format

Every snapshot MUST conform to the following versioned structure:

```
{
  "schema_version": 1,
  "org_id": "<uuid>",
  "nodo": "nodo_inmo",
  "captured_at": "<ISO 8601 UTC>",
  "tables": {
    "<schema.table_name>": [ ...rows ]
  },
  "auth_users": [ ...user subset rows ]
}
```

The `schema_version` field MUST be `1` for all v1 snapshots.  
The `captured_at` field MUST be the UTC timestamp at serialization start.  
Table keys MUST use the pattern `{schema}.{table}`.

#### Scenario: Format compliance

- GIVEN a completed serialization run
- WHEN the resulting JSON is parsed
- THEN it contains `schema_version`, `org_id`, `nodo`, `captured_at`, `tables`, and `auth_users` keys
- AND `schema_version` equals `1`

---

### Requirement: Storage Path Convention

The snapshot file MUST be uploaded to Supabase Storage bucket `org-backups` at:

```
{nodo}/{org_id}/{iso_timestamp}.json
```

Where `iso_timestamp` is the `captured_at` value with `:` replaced by `-` (safe for storage paths).

#### Scenario: Path uniqueness

- GIVEN two backup runs for the same org at different times
- WHEN both are uploaded
- THEN they occupy distinct storage paths with different timestamps

---

### Requirement: Metadata Registration

After a successful upload, the Edge Function MUST insert a row into `nodo_core.backup_snapshots` with: `org_id`, `nodo`, `snapshot_path`, `row_counts` (JSON map of table → count), `captured_at`, `size_bytes`.

#### Scenario: Successful backup metadata

- GIVEN a snapshot upload succeeds
- WHEN the Edge Function completes
- THEN a row exists in `nodo_core.backup_snapshots` with matching `snapshot_path` and correct `row_counts`

#### Scenario: Upload fails

- GIVEN a Storage upload error
- WHEN the Edge Function encounters the error
- THEN no metadata row is written and the error is returned to the caller
