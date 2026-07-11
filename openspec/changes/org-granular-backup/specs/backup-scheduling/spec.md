# backup-scheduling Specification

## Purpose

Defines requirements for the nightly automated backup trigger via Vercel Cron and its integration with the `backup-org-snapshot` Edge Function.

## Requirements

### Requirement: Nightly Cron Schedule

The Vercel Cron job MUST be configured to trigger at **02:00 UTC** daily. It MUST call `POST /api/admin/backups/trigger-all` (or iterate via `trigger` per org) from nodo-landing.

#### Scenario: Nightly trigger fires

- GIVEN the cron is configured at `0 2 * * *` UTC
- WHEN 02:00 UTC passes
- THEN the cron invokes the backup API route for all active `nodo_inmo` orgs
- AND each org produces a snapshot or logs an individual error without aborting the remaining orgs

---

### Requirement: Per-Org Isolation

The scheduling logic MUST back up each active org independently. A failure for one org MUST NOT prevent backups for other orgs from completing.

#### Scenario: One org fails during nightly run

- GIVEN org A causes an Edge Function error
- WHEN the nightly run processes org A and then org B
- THEN org B's snapshot is still created
- AND the error for org A is logged to the nightly run summary

---

### Requirement: Nightly Run Summary

After all orgs are processed, the API route MUST return (and log) a summary including: total orgs attempted, succeeded, failed, and a list of errors per failed org.

#### Scenario: Nightly summary content

- GIVEN 10 active orgs processed with 1 failure
- WHEN the nightly run completes
- THEN the summary shows `attempted: 10`, `succeeded: 9`, `failed: 1`, and the error for the failing org

---

### Requirement: Cron Authentication

The `/api/admin/backups/trigger-all` route MUST be protected. It MUST verify the `Authorization` header contains a valid Vercel Cron secret (`CRON_SECRET` env var). Requests without a valid secret MUST return 401.

#### Scenario: Valid cron secret

- GIVEN a request with `Authorization: Bearer {CRON_SECRET}`
- WHEN the route is hit
- THEN the backup run proceeds

#### Scenario: Missing or invalid secret

- GIVEN a request with no or wrong Authorization header
- WHEN the route is hit
- THEN a 401 is returned and no backup runs

---

### Requirement: Active Org Selection

The nightly run MUST only back up orgs where `shared.organizations.is_active = true`. Inactive or deleted orgs MUST be skipped.

#### Scenario: Inactive org skipped

- GIVEN an org with `is_active = false`
- WHEN the nightly backup runs
- THEN no snapshot is created for that org and it is not counted in failures
