# Exploration: nodo-clinica Supabase Integration

## Current State

### Architecture
- nodo-clinica is Next.js 16 (port 3002), NOT a Vite SPA like nodo-inmo/nodo-autos.
- It runs on /clinica/* proxied by nodo-landing via NODO_CLINICA_URL=http://localhost:5174 (but the app actually runs on 3002 — mismatch in docs).
- Already has @supabase/ssr and @supabase/supabase-js in package.json (v0.12.0 and v2.108.1), so Supabase client library is present but unused.

### Data Layer
- All data lives in a JSON file (or Vercel Blob). No Supabase DB usage today.
- `readDb` / `writeDb` called by 33 API route files, 126 total call-sites.
- `local-db.ts` is the God module — types, read/write, normalization, seed data, all in one 700-line file.

### Auth
- Cookie-based session: `clinica_session` cookie stores JSON `{userId, role, email, fullName}`.
- Login checks plaintext password against JSON: `d.password === password`.
- No JWT, no Supabase Auth, no RLS enforcement from client side.
- Session also accepts `x-clinic-*` headers (no auth — open to abuse).

### Migrations
- `001_initial_schema.sql`: Single-tenant schema in `public` schema (profiles, patients, appointments, etc.). Has RLS policies written, but these are for the old standalone-Supabase design (uses `auth_user_role()` SECURITY DEFINER function — a known anti-pattern).
- `002_nodo_clinica_ecosystem_schema.sql`: Multi-tenant schema `nodo_clinica.*` referencing `shared.organizations`. Tables: professionals, office_settings, patients, appointments, clinical_records, clinical_notes, transcriptions, prescriptions, study_orders, soap_summaries, patient_documents, doctor_tasks, interconsult_messages, doctor_presence, chat_read_cursors. RLS is ENABLED on some tables but NO POLICIES written — the file just says "repetir patrón nodo-inmo en migración dedicada".

### Missing in migration 002
- `grant usage on schema nodo_clinica to authenticated, anon, service_role` — NOT present.
- `alter default privileges in schema nodo_clinica grant all on tables to ...` — NOT present.
- Zero RLS policies (8 tables have RLS enabled, 0 policies defined).
- No `theme_settings` default null on office_settings — it exists but `NOT NULL DEFAULT '{}'` (scaffold says nullable, clinica has not-null empty object).
- Missing tables from local-db that are NOT in migration 002: `DoctorNotification`, `doctor_tasks` IS there, `nodoChatReadAt` (read cursors partially as chat_read_cursors), `doctorPresence` partially as doctor_presence.
- `doctor_presence` and `chat_read_cursors` have NO FK to professionals (just UUID PKs with no references) and NO org_id — cross-org leakage risk.
- `interconsult_messages`: `from_professional_id` and `to_professional_id` have no FK to professionals table — referential integrity gap.
- Storage bucket `patient-documents` defined in migration 001 (standalone) but NOT in migration 002 (ecosystem). Needs to be defined for the shared project.

### shared.organizations gap
- `product` column has no CHECK constraint defined in the migration file (just `default 'inmo'`). The constraint "only accepts inmo" mentioned in the brief does NOT appear in the SQL — the product column is a free text field. So adding 'clinica' as product value is structurally fine without a migration change, but it's inconsistent/undocumented.
- `shared.nodo_id` has a (org_id, product) unique — so clinica orgs can register there once product enrollment is implemented.

### Claim Hook / JWT
- nodo-inmo's `custom_access_token_hook` injects `org_id` and `role` into JWT `app_metadata`.
- RLS policies in nodo_inmo read `(select auth.jwt()) -> 'app_metadata' ->> 'org_id'` — this is the pattern clinica must use too.
- The hook currently reads from `shared.org_members` which has roles: admin, agent, owner, tenant, super_admin. Clinica needs 'doctor' and 'patient' roles. Two options: (a) reuse existing roles (admin=doctor, tenant=patient), (b) add new roles to org_members check constraint.

### nodo-scaffold compliance gaps
- nodo-clinica is Next.js, not Vite+React SPA — structural mismatch vs scaffold.
- No `use-theme-settings.ts` (uses its own `DoctorThemeSettings` type in local-db).
- No `use-clinica-theme-sync.ts`.
- No `ThemeInitializer` in providers.
- No `@nodocore/shared-components` usage.
- No `@nodocore/nodo-modules` for shared agenda/tasks/caja.
- Landing proxy points to port 5174 but app runs on 3002 — needs alignment.
- office_settings.theme_settings is `NOT NULL DEFAULT '{}'` instead of `DEFAULT NULL` (scaffold requirement).

### MercadoPago OAuth sensitive data
- OAuth tokens currently stored in JSON blob: `mercadopagoAccessToken`, `mercadopagoRefreshToken`, `mercadopagoPublicKey` on `LocalDoctor.payment`.
- In migration 002, `office_settings.payment JSONB` stores all payment config including tokens — no separation of sensitive fields.
- Risk: payment JSONB accessible to any doctor in the org if RLS is misconfigured.

## Gaps Summary

| Area | Gap | Severity |
|------|-----|----------|
| Auth | Plaintext passwords, no Supabase Auth | CRITICAL |
| Auth | Cookie session with no JWT/RLS | CRITICAL |
| Auth | x-clinic-* headers bypass auth | HIGH |
| Schema | Zero RLS policies in migration 002 | CRITICAL |
| Schema | No schema grants in migration 002 | HIGH |
| Schema | doctor_presence/chat_read_cursors no FK, no org_id | HIGH |
| Schema | interconsult_messages no FK on professional IDs | MEDIUM |
| Schema | Storage bucket not defined in migration 002 | MEDIUM |
| Schema | theme_settings NOT NULL vs scaffold's DEFAULT NULL | LOW |
| Roles | org_members roles don't include 'doctor'/'patient' | HIGH |
| Scaffold | Next.js not Vite SPA — architectural mismatch | MEDIUM |
| Scaffold | No shared-components, no nodo-modules | MEDIUM |
| API Routes | 33 files with 126 readDb/writeDb calls to migrate | HIGH effort |
| MercadoPago | OAuth tokens stored in payment JSONB — sensitive | HIGH |
| Data model | PatientHealthProfile not in migration 002 | MEDIUM |
| Data model | DoctorNotification not in migration 002 | MEDIUM |
| Data model | paymentReceiptAudit, shareHealthProfile fields missing | LOW |

## Recommended Approach

**Phase 1 — Shared infrastructure prerequisites** (migrations only, no app code):
1. Add 'clinica' to any product documentation/convention (no structural change needed).
2. Write migration 003: schema grants for nodo_clinica, fix doctor_presence/chat_read_cursors (add org_id + FK), add FK to interconsult_messages professional IDs, define storage bucket, add missing tables (DoctorNotification → clinica.doctor_notifications, patient_health_profiles).
3. Decide on org_members role strategy for clinica (recommend: doctors = 'admin', patients = separate clinica.patient_profiles table NOT in org_members since patients are not org staff).

**Phase 2 — RLS policies migration** (migration 004):
Template A pattern from nodo-inmo for doctor-side tables: `org_id = (jwt -> 'app_metadata' ->> 'org_id')::uuid AND role in ('admin', 'super_admin')`. Patient access is different: patients use `user_id = auth.uid()` directly, not org membership.

**Phase 3 — Auth migration**:
Replace cookie+plaintext with Supabase Auth. Doctor registration → `supabase.auth.signUp` + `shared.org_members` insert (role='admin'). Patient registration → `supabase.auth.signUp` + `nodo_clinica.patients` insert (no org_members row). Login → `supabase.auth.signInWithPassword`.

**Phase 4 — API route migration** (largest effort):
Replace all `readDb`/`writeDb` with Supabase client calls. 33 files, ~126 call-sites. Must be done per route group (appointments, patients, records, etc.). Each group needs both doctor-side and patient-side Supabase client patterns.

**Phase 5 — nodo-scaffold compliance** (optional / longer term):
Consider rewriting as Vite SPA for true scaffold compliance, OR keep as Next.js but implement theme-sync hook pointing to office_settings, add shared-components. The Next.js architecture has advantages (server-side API routes, no CORS for internal calls) so migration to Vite is not mandatory.

## Key Risks
1. Patient data is PHI (Protected Health Information) — RLS must be bulletproof before any real patient data enters Supabase.
2. The two-role access model (doctor=staff, patient=external) doesn't map cleanly onto nodo-inmo's staff-only org_members model. Patients should NOT be in org_members.
3. MercadoPago OAuth tokens in `office_settings.payment JSONB` need to be in a server-side secret store or at minimum in a separate table accessible only via service_role.
4. interconsult cross-org messaging (ecosystem-directory.ts uses ECOSYSTEM_PRO_CONTACTS hardcoded) — migration to Supabase Realtime changes this architecture.
5. 33 API routes must be migrated atomically or with a feature flag — partial migration risks data inconsistency between JSON and Supabase.
