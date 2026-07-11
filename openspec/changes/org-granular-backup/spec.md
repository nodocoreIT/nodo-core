# Spec: org-granular-backup

This file is an index of domain specs for this change. Each domain spec is authoritative for its area.

## Domain Specs

| Domain | File |
|--------|------|
| org-backup-snapshot | `specs/org-backup-snapshot/spec.md` |
| org-restore-snapshot | `specs/org-restore-snapshot/spec.md` |
| backup-management | `specs/backup-management/spec.md` |
| backup-scheduling | `specs/backup-scheduling/spec.md` |

## Coverage Summary

| Domain | Requirements | Scenarios |
|--------|-------------|-----------|
| org-backup-snapshot | 4 | 7 |
| org-restore-snapshot | 5 | 9 |
| backup-management | 6 | 9 |
| backup-scheduling | 5 | 7 |
| **Total** | **20** | **32** |

## V1 Scope Boundaries

- Covers: `nodo_inmo` (org_id-partitioned), `shared.organizations`, `shared.org_members`, `shared.user_profiles`, `auth.users` subset
- Out of scope: `nodo_finanzas_personales`, `nodo_autos`, `nodo_clinica`, automated retention, point-in-time recovery, cross-org restore
