# Proposal: Per-Org Granular Backup System

## Intent

A CASCADE DELETE on `auth.users` wiped all `nodo_finanzas_personales` data for a user. Recovery required a full Supabase DB restore -- expensive, risky, and affecting ALL tenants. NodoCore needs surgical per-org/per-user backup and restore so a single tenant's data can be recovered without touching anyone else.

## Scope

### In Scope
- `nodo_core.backup_snapshots` metadata table (org_id, nodo, snapshot_path, row_counts, timestamps)
- Supabase Storage bucket `org-backups` (private, service_role only)
- Edge Function `backup-org-snapshot` -- serializes one org's data (nodo_inmo + shared anchors + auth.users subset) to JSON, uploads to Storage
- Edge Function `restore-org-snapshot` -- downloads JSON, inserts in FK-dependency order, idempotent via ON CONFLICT DO NOTHING
- Vercel Cron trigger (nightly) in nodo-landing + manual "Backup Now" API route
- Admin panel UI: backup history list, manual trigger button, restore initiation
- `nodo_inmo` schema (15 tables, partitioned by `org_id`)
- `shared` schema subset (`organizations`, `org_members`, `user_profiles`)

### Out of Scope
- `nodo_finanzas_personales` backup (user_id partition -- different function signature, Phase 2)
- `nodo_autos` backup (separate tenant model via `cliente_id`)
- `nodo_clinica` backup (not yet on Supabase)
- Automated retention/lifecycle policies (manual cleanup for v1)
- External storage (S3/R2) -- Supabase Storage sufficient for v1
- Streaming serialization for very large orgs (paginated approach if needed)

## Capabilities

### New Capabilities
- `org-backup-snapshot`: Edge Function that serializes an org's data across schemas to structured JSON and uploads to Supabase Storage
- `org-restore-snapshot`: Edge Function that downloads a snapshot and restores it in FK-dependency order with auth.users re-creation
- `backup-management`: Admin panel UI and API routes for listing, triggering, and initiating restores
- `backup-scheduling`: Vercel Cron nightly trigger that backs up all active orgs

### Modified Capabilities
- None -- all new infrastructure

## Approach

**Hybrid Vercel Cron + Edge Function architecture:**

1. **Scheduling**: Vercel Cron (nightly) hits `/api/admin/backups/trigger` in nodo-landing. Also exposed as manual button in admin panel.
2. **Serialization**: API route calls Edge Function `backup-org-snapshot` via service_role. Edge Function runs SELECT queries per table in FK order, packages as versioned JSON (`schema_version: 1`), uploads to `org-backups/{nodo}/{org_id}/{iso_timestamp}.json`.
3. **Metadata**: Each snapshot registers a row in `nodo_core.backup_snapshots` with path, row counts, and timestamps.
4. **Restore**: Edge Function `restore-org-snapshot` accepts `{ org_id, snapshot_path, dry_run }`. Verifies/re-creates auth.users via Admin API, then inserts in exact reverse of `purge_org_operational_data()` order. All wrapped in transaction.
5. **Admin UI**: History table with download/restore actions per snapshot.

**Why Edge Functions for serialization?** Keeps data movement inside Supabase (no network hop), avoids Vercel 300s timeout for large orgs, transaction safety for restore.

**Why Vercel Cron for scheduling?** Team already runs nodo-landing; no new infra. Edge Functions lack native cron.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `nodo_core` schema | New table | `backup_snapshots` metadata |
| `supabase/functions/backup-org-snapshot/` | New | Serialization Edge Function |
| `supabase/functions/restore-org-snapshot/` | New | Restore Edge Function |
| `nodo-landing/src/app/api/admin/backups/` | New | Trigger + history API routes |
| `nodo-landing/src/app/panel/backups/` | New | Admin panel backup management UI |
| Supabase Storage | New bucket | `org-backups` (private) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| auth.users not in snapshot breaks restore | High | Include auth.users subset (id, email, user_metadata) in every snapshot; restore re-creates via Admin API |
| Edge Function 150s timeout for large orgs | Med | Paginate SELECT queries; stream JSON construction; monitor org sizes |
| FK RESTRICT blocks restore if order wrong | High | Encode exact dependency order from `purge_org_operational_data()` reverse; integration test with real org data |
| Snapshot JSON too large (50MB+) for single file | Low | Compress (gzip) before upload; split by table if needed in v2 |
| No existing `org-backups` bucket | Low | Create bucket in migration with service_role-only insert policy |

## Rollback Plan

All new infrastructure -- no existing behavior modified. Rollback = delete Edge Functions, drop `backup_snapshots` table, remove API routes and UI, delete Storage bucket. Zero impact on existing tenant data or auth flows.

## Dependencies

- Supabase Pro plan (Storage, Edge Functions, service_role access)
- `supabase.auth.admin.createUser` API for UUID-preserving user restore
- Existing `purge_org_operational_data()` RPC as FK-order reference

## Success Criteria

- [ ] Nightly automated backup runs for all active nodo_inmo orgs without manual intervention
- [ ] Admin can trigger on-demand backup for any org from the panel
- [ ] A complete org can be restored from snapshot to an empty state (all tables, correct row counts)
- [ ] Restore handles missing auth.users by re-creating them with original UUIDs
- [ ] Admin panel shows backup history with download and restore actions
- [ ] Restore is idempotent -- running twice produces same result
