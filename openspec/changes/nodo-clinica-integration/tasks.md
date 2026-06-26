# Tasks: nodo-clinica Supabase Integration

6 PRs, 29 tasks total. PRs are strictly sequential (each depends on previous). Tasks within a PR can run in parallel unless noted.

---

## PR 1 — Schema (Migration 003)
**Branch**: `feat/clinica-migration-003`
**Spec**: Domain 1
**Target**: ~220 lines of SQL

### T1.1 — Create migration file skeleton [SEQUENTIAL FIRST]
- `supabase migration new 003_schema_grants_and_tables` inside `nodo-clinica/`
- Output: `nodo-clinica/supabase/migrations/003_*.sql`

### T1.2 — Add schema grants [parallel after T1.1]
- Add `GRANT USAGE ON SCHEMA nodo_clinica TO anon, authenticated, service_role`
- Add `ALTER DEFAULT PRIVILEGES` grant block
- Spec: Scenario 1.1

### T1.3 — Fix FK integrity gaps [parallel after T1.1]
- Add `doctor_presence.professional_id → nodo_clinica.professionals(id) ON DELETE CASCADE`
- Add `chat_read_cursors.professional_id → nodo_clinica.professionals(id) ON DELETE CASCADE`
- Add `interconsult_messages.from_professional_id → nodo_clinica.professionals(id)`
- Add `interconsult_messages.to_professional_id → nodo_clinica.professionals(id)`
- Spec: Scenario 1.2

### T1.4 — Add org_id to presence + cursor tables [parallel after T1.1]
- `ALTER TABLE nodo_clinica.doctor_presence ADD COLUMN org_id uuid NOT NULL REFERENCES shared.organizations(id)`
- `ALTER TABLE nodo_clinica.chat_read_cursors ADD COLUMN org_id uuid NOT NULL REFERENCES shared.organizations(id)`
- Required for RLS cross-org isolation (Design ADR-2)

### T1.5 — Create missing tables [parallel after T1.1]
- `nodo_clinica.patient_health_profiles` (id, patient_id FK cascade, blood_type, allergies[], chronic_conditions[], insurance_provider, insurance_number, created_at, updated_at)
- `nodo_clinica.doctor_notifications` (id, org_id FK, professional_id FK, type, payload jsonb, read bool, created_at)
- `nodo_clinica.payment_credentials` (id, org_id UNIQUE FK, access_token, refresh_token, public_key, token_expires_at, created_at, updated_at)
- Enable RLS on all three immediately
- Add `updated_at` trigger via `moddatetime` on all new tables
- Spec: Scenarios 1.4 (payment_credentials RLS blocks authenticated)

### T1.6 — Create storage bucket [parallel after T1.1]
- SQL: `INSERT INTO storage.buckets (id, name, public) VALUES ('patient-documents', 'patient-documents', false)`
- Spec: Scenario 1.3

### T1.7 — Fix theme_settings column [parallel after T1.1]
- `ALTER TABLE nodo_clinica.office_settings ALTER COLUMN theme_settings DROP NOT NULL DROP DEFAULT; ALTER TABLE nodo_clinica.office_settings ALTER COLUMN theme_settings SET DEFAULT NULL`
- Spec: Domain 1 / nodo-scaffold convention

### T1.8 — Add FK indexes [parallel after T1.1]
- `CREATE INDEX ON nodo_clinica.appointments(patient_id)`
- `CREATE INDEX ON nodo_clinica.appointments(org_id)`
- `CREATE INDEX ON nodo_clinica.clinical_records(patient_id)`
- `CREATE INDEX ON nodo_clinica.clinical_records(org_id)`
- `CREATE INDEX ON nodo_clinica.doctor_notifications(professional_id)`
- `CREATE INDEX ON nodo_clinica.doctor_notifications(org_id)`
- Spec: Cross-Cutting / Performance

### T1.9 — Run advisors and verify [SEQUENTIAL LAST]
- `supabase db advisors` — resolve any HIGH/CRITICAL
- Manual check: Scenarios 1.1, 1.2, 1.3, 1.4

**Verification**: `rg "nodo_clinica" nodo-clinica/supabase/migrations/003_*.sql` shows all tables. Supabase dashboard confirms bucket exists. No advisor HIGH/CRITICAL.

---

## PR 2 — RLS Policies (Migration 004)
**Branch**: `feat/clinica-migration-004`
**Depends on**: PR 1 merged
**Spec**: Domain 2
**Target**: ~350 lines of SQL

### T2.1 — Create migration file [SEQUENTIAL FIRST]
- `supabase migration new 004_rls_policies`

### T2.2 — Enable RLS on all tables not yet covered [parallel after T2.1]
- `ALTER TABLE nodo_clinica.{table} ENABLE ROW LEVEL SECURITY` for every table in `nodo_clinica.*` that was not covered in migration 002
- Confirm: patients, appointments, clinical_records, clinical_notes, prescriptions, soap_summaries, study_orders, patient_documents, patient_health_profiles, doctor_notifications, payment_credentials, doctor_presence, chat_read_cursors, office_settings

### T2.3 — Template A policies: doctor/staff tables [parallel after T2.1]
- `office_settings`: SELECT (org_id match, authenticated), UPDATE (org_id match + role admin/super_admin, WITH CHECK)
- `doctor_presence`: SELECT/INSERT/UPDATE/DELETE — org_id match + professional_id = auth.uid() join
- `chat_read_cursors`: same pattern, include org_id
- Pattern: `using (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid)`
- Do NOT use `auth.role()`. Use `TO authenticated` + USING predicate.
- Spec: Scenario 2.7

### T2.4 — Template A policies: doctor-only data tables [parallel after T2.1]
- Tables: `professionals`, `doctor_notifications`, `interconsult_messages`
- `professionals`: SELECT/INSERT/UPDATE org_id match; DELETE super_admin only
- `doctor_notifications`: SELECT (org_id + professional_id → auth.uid()), UPDATE mark-as-read (same + WITH CHECK)
- `interconsult_messages`: SELECT/INSERT org_id match for from_professional_id
- Spec: Scenarios 2.1, 2.6

### T2.5 — Dual Template A+P policies: shared tables [parallel after T2.1]
- Tables: `patients`, `appointments`, `clinical_records`, `clinical_notes`, `prescriptions`, `soap_summaries`, `study_orders`, `patient_documents`, `patient_health_profiles`
- Doctor SELECT policy: org_id match (Template A)
- Patient SELECT policy: patient_id in (select id from patients where profile_id = (select auth.uid())) — Template P
- Doctor INSERT/UPDATE: org_id match WITH CHECK (prevent cross-org insert)
- Doctor DELETE on PHI: super_admin only; admin cannot DELETE clinical_records, clinical_notes, prescriptions, soap_summaries, study_orders
- Patient UPDATE on patient_health_profiles only: auth.uid() = profile_id path, WITH CHECK
- Patient INSERT/UPDATE/DELETE on all other PHI tables: NOT GRANTED
- Use scalar subquery pattern `(select auth.uid())` and `(select auth.jwt())` — not bare calls
- Spec: Scenarios 2.1, 2.2, 2.3, 2.4, 2.6

### T2.6 — payment_credentials: NO authenticated policies [parallel after T2.1]
- RLS already enabled (T1.5). Confirm zero policies exist for `authenticated` role.
- Only service_role accesses this table (bypasses RLS by default).
- Spec: Scenario 2.5

### T2.7 — Storage policies for patient-documents bucket [parallel after T2.1]
- INSERT: authenticated + path starts with `{org_id}/{patient_id}/`
- SELECT (download): authenticated + (doctor org_id match OR patient auth.uid() match)
- UPDATE: same as INSERT (needed for upsert per Supabase Storage upsert rule)
- Do NOT grant DELETE to authenticated

### T2.8 — Run advisors and finalize [SEQUENTIAL LAST]
- `supabase db advisors` — must resolve ALL HIGH/CRITICAL before merge
- Write 3 manual smoke tests (doctor query, patient query, anon query) per Scenarios 2.1–2.7

**Verification**: Run Scenarios 2.1–2.7 manually with test JWT tokens (set via Supabase SQL editor `SET LOCAL role`). Zero HIGH/CRITICAL advisors.

---

## PR 3 — Authentication
**Branch**: `feat/clinica-supabase-auth`
**Depends on**: PR 2 merged
**Spec**: Domain 3
**Target**: ~280 lines TypeScript

### T3.1 — Add clinica-specific Supabase client options [parallel]
- Create `nodo-clinica/src/lib/supabase/clinica-auth.ts`
- Export `clinicaSupabaseClientOptions` with `db: { schema: 'nodo_clinica' }` and `cookieOptions: { name: 'nodo-auth-clinica' }`
- Design: ADR-1

### T3.2 — Update Supabase client files [parallel after T3.1]
- `nodo-clinica/src/lib/supabase/middleware.ts`: remove `isLocalMode()` guard, apply `clinicaSupabaseClientOptions`
- `nodo-clinica/src/lib/supabase/server.ts`: apply `clinicaSupabaseClientOptions` to `createServerClient`
- `nodo-clinica/src/lib/supabase/client.ts`: apply `clinicaSupabaseClientOptions` to browser client

### T3.3 — Feature flag setup [parallel]
- Add `USE_SUPABASE_AUTH=false` to `.env.local.example`
- Add flag read helper to `nodo-clinica/src/lib/clinic/config.ts`: `export const USE_SUPABASE_AUTH = process.env.USE_SUPABASE_AUTH === 'true'`

### T3.4 — Migrate login route [SEQUENTIAL after T3.2 + T3.3]
- `nodo-clinica/src/app/api/clinic/account/login/route.ts`
- When `USE_SUPABASE_AUTH=true`: call `supabase.auth.signInWithPassword({ email, password })`; return session user (role from JWT app_metadata)
- When flag=false: existing cookie path unchanged
- Remove plaintext `d.password === password` comparison behind flag
- Remove `x-clinic-*` header bypass entirely (not behind flag — always remove)
- Spec: Scenarios 3.1, 3.2, 3.4

### T3.5 — Migrate register routes [parallel after T3.2]
- `nodo-clinica/src/app/api/clinic/account/register/route.ts`
- Doctor path: `supabase.auth.signUp()` → insert `shared.org_members(role='admin')` → insert `nodo_clinica.professionals`; service_role client for cross-schema inserts
- Patient path: `supabase.auth.signUp()` → insert `nodo_clinica.patients(profile_id=auth.uid())`; NO org_members row
- Spec: Domain 3 registration requirements

### T3.6 — Migrate session route [parallel after T3.2]
- `nodo-clinica/src/app/api/clinic/account/session/route.ts`
- Replace `getSessionFromRequest()` cookie read with `supabase.auth.getUser()`
- Return 401 if no valid session
- Spec: Scenario 3.3

### T3.7 — Create auth guard helper [parallel after T3.2]
- Create `nodo-clinica/src/lib/supabase/auth-guard.ts`
- Export `requireAuth(req, res): Promise<{ user, supabase } | NextResponse>` — calls `getUser()`, returns 401 response if not authed, else user + client
- This is the reusable guard all API routes in PR4+PR5 will use
- Design: ADR-4 (thin service layer)

### T3.8 — Delete session.ts [SEQUENTIAL LAST, after T3.4+T3.5+T3.6]
- Gate this behind confirming no remaining `import.*session` references outside the legacy path
- `rg "from.*lib/clinic/session"` must return 0 outside login route legacy branch
- Then delete `nodo-clinica/src/lib/clinic/session.ts`
- Spec: Domain 4 completeness (session.ts must not exist after migration)

**Verification**: Scenarios 3.1–3.5. Toggle `USE_SUPABASE_AUTH` and confirm both paths work. `rg "x-clinic-"` returns 0 matches.

---

## PR 4 — API Routes Batch 1 (patients, appointments, clinical-records)
**Branch**: `feat/clinica-api-batch1`
**Depends on**: PR 3 merged
**Spec**: Domain 4
**Target**: ~380 lines TypeScript

### T4.1 — Create service layer modules [SEQUENTIAL FIRST — others depend on these]
- `nodo-clinica/src/lib/clinic/db/patients.ts` — typed CRUD: `getPatients`, `getPatientById`, `createPatient`, `updatePatient`, `getPatientHealthProfile`, `upsertHealthProfile`
- `nodo-clinica/src/lib/clinic/db/appointments.ts` — `getAppointments`, `getAppointmentById`, `createAppointment`, `updateAppointment`, `cancelAppointment`
- `nodo-clinica/src/lib/clinic/db/clinical-records.ts` — `getRecords`, `createRecord`, `getNotes`, `createNote`, `getSOAP`, `createSOAP`, `getPrescriptions`, `createPrescription`, `getStudyOrders`, `createStudyOrder`
- All functions accept a Supabase client as first arg (Design: ADR-4)

### T4.2 — Migrate /api/clinic/patients routes [parallel after T4.1]
- `nodo-clinica/src/app/api/clinic/patients/route.ts`
- Replace `readDb`/`writeDb` with `requireAuth()` → service layer calls
- Validate `org_id` on patient insert matches JWT org_id (Spec: Domain 4)
- Spec: Scenario 4.4

### T4.3 — Migrate /api/appointments and /api/clinic/appointments [parallel after T4.1]
- `nodo-clinica/src/app/api/appointments/route.ts`
- `nodo-clinica/src/app/api/clinic/appointments/route.ts`
- `nodo-clinica/src/app/api/clinic/schedule/route.ts`
- `nodo-clinica/src/app/api/clinic/reminders/route.ts`
- `nodo-clinica/src/app/api/cron/appointment-reminders/route.ts` (cron: service_role client, no user auth needed)
- Replace `readDb`/`writeDb` with service layer
- Spec: Scenarios 4.1, 4.2

### T4.4 — Migrate clinical-records batch [parallel after T4.1]
- `nodo-clinica/src/app/api/clinic/clinical-records/route.ts`
- `nodo-clinica/src/app/api/clinic/clinical-records/pdf/route.ts`
- `nodo-clinica/src/app/api/clinic/notes/route.ts`
- `nodo-clinica/src/app/api/clinic/study-orders/route.ts`
- `nodo-clinica/src/app/api/study-orders/route.ts`
- `nodo-clinica/src/app/api/clinic/prescriptions/route.ts`
- `nodo-clinica/src/app/api/prescriptions/route.ts`
- `nodo-clinica/src/app/api/prescriptions/send/route.ts`
- `nodo-clinica/src/app/api/clinic/patient-history/route.ts`
- `nodo-clinica/src/app/api/clinic/clinical-report/generate/route.ts`
- `nodo-clinica/src/app/api/soap/generate/route.ts`
- Spec: Scenarios 4.3, 4.4

### T4.5 — Migrate documents route [parallel after T4.1]
- `nodo-clinica/src/app/api/clinic/documents/route.ts`
- Upload: `createServiceClient()` → Supabase Storage `patient-documents` bucket
- Download: generate signed URL server-side, return to client
- Path format: `{org_id}/{patient_id}/{filename}`
- Design: ADR-7

### T4.6 — Verify no readDb/writeDb in batch 1 routes [SEQUENTIAL LAST]
- `rg "readDb|writeDb"` in batch 1 route directories
- Must return 0 matches
- Spec: Scenario 4.4

**Verification**: Scenarios 4.1–4.4. Test with doctor JWT (expect org-scoped data) and patient JWT (expect own data only). `rg "readDb|writeDb"` in batch 1 route dirs = 0.

---

## PR 5 — API Routes Batch 2 (interconsult, MercadoPago, admin)
**Branch**: `feat/clinica-api-batch2`
**Depends on**: PR 4 merged
**Spec**: Domain 5
**Target**: ~370 lines TypeScript

### T5.1 — Create payments service module [SEQUENTIAL FIRST]
- `nodo-clinica/src/lib/clinic/db/payments.ts`
- `getPaymentCredentials(orgId)`: uses `createServiceClient()` only — never authenticated client
- `upsertPaymentCredentials(orgId, tokens)`: same
- `clearOAuthTokensFromOfficeSettings(orgId)`: removes access_token, refresh_token, public_key from office_settings.payment JSONB
- Design: ADR-5, Spec: Scenario 5.1

### T5.2 — Migrate MercadoPago routes [parallel after T5.1]
- `nodo-clinica/src/app/api/clinic/mercadopago/route.ts`
- `nodo-clinica/src/app/api/clinic/mercadopago/oauth/connect/route.ts`
- `nodo-clinica/src/app/api/clinic/mercadopago/oauth/callback/route.ts`
- `nodo-clinica/src/app/api/clinic/mercadopago/oauth/disconnect/route.ts`
- `nodo-clinica/src/app/api/clinic/mercadopago/oauth/config/route.ts`
- `nodo-clinica/src/app/api/clinic/mercadopago/oauth/diagnose/route.ts`
- `nodo-clinica/src/app/api/clinic/mercadopago/sync/route.ts`
- `nodo-clinica/src/app/api/clinic/mercadopago/test/qr/route.ts`
- `nodo-clinica/src/app/api/webhooks/mercadopago/route.ts`
- `nodo-clinica/src/app/api/clinic/payment-receipt/validate/route.ts`
- `nodo-clinica/src/app/api/clinic/payment-receipt/preview/route.ts`
- All token reads go through `payments.ts` service (service_role)
- After migration: call `clearOAuthTokensFromOfficeSettings` to clean office_settings JSONB
- Spec: Scenario 5.1

### T5.3 — Migrate interconsult routes [parallel after T5.1]
- `nodo-clinica/src/app/api/clinic/interconsult/messages/route.ts`
- `nodo-clinica/src/app/api/clinic/interconsult/read/route.ts`
- `nodo-clinica/src/app/api/clinic/interconsult/directory/route.ts`
- `nodo-clinica/src/app/api/clinic/interconsult/presence/route.ts`
- `nodo-clinica/src/app/api/clinic/interconsult/unread/route.ts`
- Replace `readDb`/`writeDb` with Supabase queries
- `directory/route.ts`: replace ECOSYSTEM_PRO_CONTACTS with query to `nodo_clinica.professionals`; route returns 422 if professional_id FKs invalid
- Include org_id in presence + cursor operations (T1.4 added the column)
- Spec: Scenarios 5.2, Domain 5

### T5.4 — Migrate admin and misc routes [parallel after T5.1]
- `nodo-clinica/src/app/api/clinic/admin/users/route.ts` — verify `role = 'super_admin'` from JWT only (not request body)
- `nodo-clinica/src/app/api/clinic/doctors/route.ts`
- `nodo-clinica/src/app/api/clinic/tasks/route.ts`
- `nodo-clinica/src/app/api/clinic/notifications/route.ts` — use doctor_notifications table
- `nodo-clinica/src/app/api/clinic/health/route.ts`
- `nodo-clinica/src/app/api/clinic/jitsi-token/route.ts`
- `nodo-clinica/src/app/api/clinic/medications/search/route.ts`

### T5.5 — Delete local-db.ts [SEQUENTIAL LAST]
- Confirm `rg "readDb|writeDb"` across entire `nodo-clinica/src/app/api/` = 0 matches
- Then delete `nodo-clinica/src/lib/clinic/local-db.ts`
- Update any remaining `import` references to remove the file
- Spec: Scenario 5.3

**Verification**: Scenarios 5.1–5.3. `rg "readDb|writeDb" nodo-clinica/src/app/api/` = 0. `rg "ECOSYSTEM_PRO_CONTACTS" nodo-clinica/` = 0. `local-db.ts` does not exist.

---

## PR 6 — Scaffold Compliance
**Branch**: `feat/clinica-scaffold`
**Depends on**: PR 3 merged (needs Supabase client + office_settings working)
**Note**: CAN be developed in parallel with PR 4+5 — only depends on PR 3
**Spec**: Domain 6
**Target**: ~180 lines TypeScript + config

### T6.1 — Fix landing proxy port [parallel]
- `nodo-landing/next.config.ts`: change clinica proxy destination from port 5174 to 3002
- Verify `NODO_CLINICA_URL` env var in `.env.local.example`
- Spec: Scenario 6.3

### T6.2 — Create use-theme-settings.ts [parallel]
- `nodo-clinica/src/shared/hooks/use-theme-settings.ts`
- Copy from `nodo-inmo/src/shared/hooks/use-theme-settings.ts`
- Change: `STORAGE_KEY = "nodo-clinica-theme-settings"`, `brandText: "nodo clinica"`
- Export both `useThemeSettings()` hook and `useThemeStore` Zustand store
- Spec: Scenario 6.1

### T6.3 — Create use-clinica-theme-sync.ts [parallel after T6.2]
- `nodo-clinica/src/shared/hooks/use-clinica-theme-sync.ts`
- Load: query `office_settings.theme_settings` via Supabase; merge into Zustand store
- Save: `saveClinicaThemeSettings(settings)` — UPDATE office_settings.theme_settings (RLS restricts to own org row)
- Pattern from nodo-scaffold SKILL.md
- Spec: Scenarios 6.1, 6.2

### T6.4 — Wire ThemeInitializer in providers [parallel after T6.3]
- Locate app providers file (likely `nodo-clinica/src/app/providers.tsx` or similar)
- Add `ThemeInitializer` wrapping `useClinicaThemeSync()` + `useThemeSettings()` inside `AuthProvider`
- Spec: Scenario 6.1

### T6.5 — Add interactive.css import [parallel]
- `nodo-clinica/src/index.css` (or equivalent global CSS): add `@import "@nodocore/shared-components/styles/interactive.css"` after tailwind import
- Spec: Scenario 6.4

### T6.6 — Wire settings dialog save [parallel after T6.3]
- Find settings dialog component in nodo-clinica
- Wire `onOpenChange` to call `saveClinicaThemeSettings(settings)` on close
- Best-effort (localStorage fallback already present)
- Spec: Scenario 6.2

**Verification**: Scenarios 6.1–6.4. Navigate to `/nodo-clinica/login` on landing port and confirm no 502. Theme persists across page reload. Pointer cursor visible on buttons.

---

## Review Workload Forecast

| PR | Description | Estimated Lines | Risk |
|----|-------------|-----------------|------|
| PR 1 | Migration 003 (schema) | ~220 SQL | Low — SQL only, no app code |
| PR 2 | Migration 004 (RLS) | ~350 SQL | High — security-critical, needs advisor clean pass |
| PR 3 | Auth migration | ~280 TS | Medium — feature flag reduces risk, 6 files |
| PR 4 | API Batch 1 | ~380 TS | Medium — 15 route files, service layer creation |
| PR 5 | API Batch 2 | ~370 TS | Medium-High — MP token isolation is high-stakes |
| PR 6 | Scaffold | ~180 TS+config | Low — mechanical pattern copy |
| **Total** | | **~1780 lines** | |

Chained PRs recommended: YES (6 PRs already defined)
400-line budget risk: PR 4 and PR 5 approach budget — keep service layer lean.

## Dependency Graph

```
PR1 (schema) → PR2 (RLS) → PR3 (auth) → PR4 (api-batch1) → PR5 (api-batch2)
                                       ↘
                                         PR6 (scaffold) ← independent from PR4/5
```

PR6 only requires PR3. It can be developed and merged any time after PR3 lands.

---

## Risks and Bottlenecks

1. **PR2 is the hardest blocker**: Dual-template RLS correctness gating everything. Advisor pass is required. If policies are wrong, PHI data is exposed or app breaks.
2. **T4.1 service layer**: All of PR4 is blocked on this. If typing is incomplete, T4.2–T4.5 slow down.
3. **T5.1 payment service**: Same bottleneck for PR5. MercadoPago token migration must happen before route refactoring.
4. **local-db.ts deletion (T5.5)**: Can only happen after ALL route files in PR4 AND PR5 are migrated. This is the final proof of completeness.
5. **org_id on doctor_presence + chat_read_cursors (T1.4)**: These columns are NOT NULL. If there is existing data, a backfill query is needed before adding the constraint. This requires investigation before writing T1.4 SQL.
