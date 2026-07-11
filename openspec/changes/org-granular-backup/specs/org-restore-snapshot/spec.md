# org-restore-snapshot Specification

## Purpose

Defines requirements for the Edge Function that downloads a snapshot from Storage and restores org data in FK-dependency order, including auth.users re-creation, within a single database transaction.

## Requirements

### Requirement: Restore Trigger Authorization

Only admin users MAY trigger a restore. The Edge Function MUST reject calls without a valid service_role or admin JWT.

#### Scenario: Unauthorized restore attempt

- GIVEN a request without a valid admin/service_role token
- WHEN `restore-org-snapshot` is called
- THEN the function returns 401 and performs no data mutations

---

### Requirement: auth.users Handling

Before inserting any org data, the function MUST verify whether the org's `auth.users` exist. For each missing user, it MUST re-create them via `supabase.auth.admin.createUser` preserving the original UUID, email, and `user_metadata`.

#### Scenario: auth.users already exist

- GIVEN all users in the snapshot already exist in `auth.users`
- WHEN restore runs
- THEN no new auth users are created and data restore proceeds normally

#### Scenario: auth.users missing

- GIVEN one or more users in the snapshot do not exist in `auth.users`
- WHEN restore runs
- THEN each missing user is re-created with their original UUID before data is inserted

#### Scenario: auth.users re-creation fails

- GIVEN `auth.admin.createUser` returns an error for a user
- WHEN restore runs
- THEN the entire restore is aborted, the transaction is rolled back, and the error is reported

---

### Requirement: FK-Ordered Restore

Tables MUST be restored in the exact reverse order of `purge_org_operational_data()` (i.e., leaf tables first, anchor tables last for delete; anchor tables first, leaf tables last for insert).

`shared.organizations` and `shared.org_members` MUST be restored before any `nodo_inmo` tables.

#### Scenario: Correct insert order

- GIVEN a snapshot with data spanning all `nodo_inmo` tables and `shared` anchors
- WHEN restore runs
- THEN no FK RESTRICT violation occurs during insertion

#### Scenario: FK violation detected

- GIVEN a snapshot where the insert order would violate a FK constraint
- WHEN the transaction encounters the violation
- THEN the transaction is rolled back and the error identifies the offending table

---

### Requirement: Idempotent Restore

All inserts MUST use `INSERT … ON CONFLICT (id) DO NOTHING`. Running the same restore twice MUST produce the same final state.

#### Scenario: Duplicate restore

- GIVEN a completed restore for an org
- WHEN restore is triggered again with the same snapshot
- THEN row counts are unchanged and no error is returned

---

### Requirement: Restore Report

On completion (success or partial failure), the function MUST return a report containing:

| Field | Description |
|-------|-------------|
| `status` | `success` \| `partial` \| `failed` |
| `duration_ms` | Total wall-clock duration |
| `tables` | Map of `table_name → { inserted, skipped, errors }` |
| `auth_users` | `{ created, skipped, errors }` |
| `error` | Error message if status is not `success` |

#### Scenario: Successful restore report

- GIVEN a restore that completes without errors
- WHEN the function returns
- THEN `status` is `success` and each table entry shows correct `inserted` counts

#### Scenario: Partial failure report

- GIVEN a restore that fails mid-way
- WHEN the transaction rolls back
- THEN `status` is `failed` and `error` describes the root cause
