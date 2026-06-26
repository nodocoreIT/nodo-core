# Proposal: nodo-clinica Supabase Integration

## Intent

nodo-clinica stores PHI (clinical records, prescriptions, SOAP notes) in a JSON file with plaintext passwords and no access control. Every API route is unprotected. This is a security-critical gap that must be closed before any production use. The change migrates nodo-clinica to the shared Supabase infrastructure (auth, RLS, schema) used by nodo-inmo and nodo-autos.

**Why now**: The app is functional but shipping with zero data protection on health data. Every day it runs in this state is liability exposure.

**Success**: All 33 API routes use Supabase with RLS enforced. Doctors access data via org_id JWT claims. Patients access only their own records via auth.uid(). No plaintext passwords. MercadoPago tokens isolated from client access.

## Scope

### In Scope
- Migration 003: schema grants, FK fixes, missing tables, storage bucket, theme_settings fix
- Migration 004: complete RLS policies (doctor org_id-based + patient uid-based)
- Auth migration: Supabase Auth replacing cookie+plaintext session
- API route migration: replace readDb/writeDb across 33 files (126 call-sites)
- MercadoPago token isolation (separate table, service_role-only access)
- Port alignment (landing proxy vs actual dev port)
- Theme sync hook + shared-components integration

### Out of Scope
- Rewriting Next.js to Vite SPA (Next.js stays — server-side routes needed for webhooks, video, AI)
- nodo-modules integration (agenda/caja) — separate future change
- Supabase Realtime for chat/presence — separate change after base migration
- Cross-org interconsult directory (ecosystem contacts) — deferred
- Patient-facing mobile app considerations

## Capabilities

### New Capabilities
- `clinica-auth`: Supabase Auth for doctor login/register (org_members) and patient self-registration (uid-based, no org_members)
- `clinica-rls`: Row-level security policies for all nodo_clinica tables (dual model: doctor=org_id, patient=auth.uid)
- `clinica-payment-isolation`: MercadoPago OAuth tokens in a separate service_role-only table

### Modified Capabilities
- `clinica-schema` (migration 002): FK fixes, schema grants, missing tables, storage bucket, theme_settings nullability

## Approach

**6 chained PRs** respecting the 400-line budget:

| PR | Scope | Est. Lines | Dependencies |
|----|-------|-----------|--------------|
| 1 | Migration 003: schema grants, FK fixes, missing tables, storage bucket | ~220 | None |
| 2 | Migration 004: RLS policies (all tables, dual access model) | ~350 | PR 1 |
| 3 | Auth migration: Supabase Auth setup, login/register, session replacement | ~280 | PR 2 |
| 4 | API routes batch 1: patients, appointments, clinical-records (~15 files) | ~380 | PR 3 |
| 5 | API routes batch 2: remaining routes, MercadoPago isolation (~18 files) | ~370 | PR 4 |
| 6 | Scaffold compliance: theme sync, shared-components, port fix, landing entry | ~180 | PR 3 |

PR 6 can run in parallel with PRs 4-5.

**Key design decisions**:
- Doctors are org staff via shared.org_members (role='admin'). JWT claim hook already handles this.
- Patients are service users with NO org_members row. RLS uses `auth.uid()` directly. Same model as tenants in nodo-inmo.
- MercadoPago tokens move to `nodo_clinica.payment_credentials` with service_role-only RLS (no anon/authenticated SELECT).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `nodo-clinica/supabase/migrations/` | New | Migrations 003 + 004 |
| `nodo-clinica/src/lib/clinic/local-db.ts` | Removed | Replaced by Supabase client |
| `nodo-clinica/src/lib/clinic/session.ts` | Removed | Replaced by Supabase Auth |
| `nodo-clinica/src/app/api/**` | Modified | 33 route files, 126 call-sites |
| `nodo-clinica/src/lib/supabase/` | New | Server/client Supabase utilities |
| `nodo-landing/next.config.ts` | Modified | Port alignment for clinica proxy |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RLS misconfiguration exposes PHI | Med | Migration 004 gets dedicated security review PR; test with both doctor and patient roles before merging |
| 126 call-site migration introduces regressions | High | Batch by route group; each batch gets manual smoke test before merge |
| Patient auth.uid() pattern doesn't match existing claim hook | Low | Claim hook is org_members-based; patients without org_members simply get no org claims — uid() still works |
| MercadoPago token migration breaks active OAuth sessions | Med | Keep JSON fallback read-only during transition; migrate tokens via script |

## Rollback Plan

Each PR is independently revertable. Migration rollbacks via `supabase db reset` to prior state. Auth migration includes a feature flag (`USE_SUPABASE_AUTH=true`) so cookie auth can be restored by toggling env var. API route batches can be reverted per-PR without affecting other batches.

## Dependencies

- shared.custom_access_token_hook must be deployed (already done per v2 migration 20260621000002)
- Supabase project must accept nodo_clinica schema (shared project, already partially set up via migration 002)

## Success Criteria

- [ ] Zero API routes use readDb/writeDb — all use Supabase client
- [ ] All nodo_clinica tables have RLS policies (verified via `supabase db advisors`)
- [ ] Doctor access scoped by org_id JWT claim; patient access scoped by auth.uid()
- [ ] No plaintext passwords — all auth via Supabase Auth
- [ ] MercadoPago tokens inaccessible to authenticated role (service_role only)
- [ ] PHI tables (clinical_records, prescriptions, soap_summaries) pass RLS audit
