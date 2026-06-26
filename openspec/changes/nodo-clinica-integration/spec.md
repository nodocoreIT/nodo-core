# Spec: nodo-clinica Supabase Integration

## Scope

Delta spec — what MUST be true after all 6 PRs are merged. Organized by domain.
Does not describe implementation; describes observable behavior and invariants.

---

## Domain 1: Schema — Migration 003

### Requirements

**MUST** add schema-level grants so the Data API can reach `nodo_clinica.*`:

```sql
grant usage on schema nodo_clinica to anon, authenticated, service_role;
alter default privileges in schema nodo_clinica
  grant all on tables to anon, authenticated, service_role;
```

**MUST** fix referential integrity gaps introduced in migration 002:
- `doctor_presence.professional_id` MUST reference `nodo_clinica.professionals(id)` with `ON DELETE CASCADE`.
- `chat_read_cursors.professional_id` MUST reference `nodo_clinica.professionals(id)` with `ON DELETE CASCADE`.
- `interconsult_messages.from_professional_id` MUST reference `nodo_clinica.professionals(id)`.
- `interconsult_messages.to_professional_id` MUST reference `nodo_clinica.professionals(id)`.

**MUST** add `org_id uuid NOT NULL REFERENCES shared.organizations(id)` to `doctor_presence` and `chat_read_cursors` (they have none today — cross-org leakage risk).

**MUST** create missing tables:
- `nodo_clinica.patient_health_profiles` — stores chronic conditions, allergies, blood type, insurance info. Columns: `id uuid PK`, `patient_id uuid NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE`, `blood_type text`, `allergies text[]`, `chronic_conditions text[]`, `insurance_provider text`, `insurance_number text`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.
- `nodo_clinica.doctor_notifications` — stores doctor-facing notifications. Columns: `id uuid PK`, `org_id uuid NOT NULL REFERENCES shared.organizations(id)`, `professional_id uuid NOT NULL REFERENCES nodo_clinica.professionals(id)`, `type text NOT NULL`, `payload jsonb`, `read boolean NOT NULL DEFAULT false`, `created_at timestamptz NOT NULL DEFAULT now()`.
- `nodo_clinica.payment_credentials` — isolated MercadoPago OAuth tokens. Columns: `id uuid PK`, `org_id uuid NOT NULL UNIQUE REFERENCES shared.organizations(id)`, `access_token text NOT NULL`, `refresh_token text`, `public_key text`, `token_expires_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

**MUST** create storage bucket `patient-documents` in the shared Supabase project with `public = false`.

**MUST** change `office_settings.theme_settings` from `NOT NULL DEFAULT '{}'` to `DEFAULT NULL` to comply with nodo-scaffold convention.

**SHOULD** add `updated_at` trigger on every new table using the existing `moddatetime` extension or equivalent.

### Acceptance Scenarios

**Scenario 1.1 — Schema grants**
- Given migration 003 has been applied
- When an `authenticated` role queries any `nodo_clinica.*` table
- Then Postgres does NOT return `permission denied for schema nodo_clinica`

**Scenario 1.2 — FK integrity**
- Given migration 003 has been applied
- When an attempt is made to insert into `interconsult_messages` with a `from_professional_id` that does not exist in `nodo_clinica.professionals`
- Then Postgres returns a foreign key violation error

**Scenario 1.3 — Storage bucket**
- Given migration 003 has been applied
- When listing storage buckets via the Supabase API
- Then a bucket named `patient-documents` exists with `public = false`

**Scenario 1.4 — MercadoPago table**
- Given migration 003 has been applied
- When an `authenticated` role attempts SELECT on `nodo_clinica.payment_credentials`
- Then RLS blocks the query (0 rows returned, not a permission error — RLS is active)

---

## Domain 2: RLS Policies — Migration 004

### Requirements

**MUST** enable RLS on every table in `nodo_clinica.*` that does not have it enabled yet (migration 002 enabled RLS on some but defined zero policies).

**MUST** implement dual access model:
- Doctor-side tables: access granted when `(select auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid = table.org_id` AND the JWT role claim is `admin` or `super_admin`.
- Patient-side tables: access granted when `auth.uid() = table.patient_id` (or the FK path to the patient's auth.uid).

**MUST NOT** use `auth.role()` in any policy (deprecated; breaks with anonymous sign-ins). Use the `TO authenticated` clause instead.

**MUST** define separate policies per operation (SELECT, INSERT, UPDATE, DELETE) where the access condition differs.

**MUST** include `WITH CHECK` on every UPDATE policy. UPDATE without WITH CHECK allows silent row reassignment.

**MUST** apply PHI-specific policies to: `clinical_records`, `clinical_notes`, `prescriptions`, `soap_summaries`, `study_orders`, `patient_documents`, `patient_health_profiles`.

PHI table access rules:
- **Doctor SELECT**: org_id match + role admin/super_admin.
- **Doctor INSERT/UPDATE**: org_id match + role admin/super_admin. WITH CHECK enforces org_id equals JWT org_id (cannot write to another org).
- **Doctor DELETE**: MUST be restricted. Only super_admin may delete clinical records. Regular admin MUST NOT have DELETE on PHI tables.
- **Patient SELECT**: `auth.uid() = (SELECT profile_id FROM nodo_clinica.patients WHERE id = patient_id)`. Patient reads only their own PHI.
- **Patient INSERT/UPDATE/DELETE on PHI**: NOT granted. Patients are read-only on their clinical data. Exception: `patient_health_profiles` — patient MAY update their own health profile.

`payment_credentials` table:
- **MUST** have NO SELECT/INSERT/UPDATE/DELETE policies for `authenticated` role.
- Access ONLY via `service_role` (bypasses RLS). This is the isolation guarantee.

`doctor_notifications`:
- **Doctor SELECT**: org_id match + professional_id match (`auth.uid() = (SELECT auth_user_id FROM nodo_clinica.professionals WHERE id = professional_id)`).
- **Doctor UPDATE** (mark as read): same condition + WITH CHECK.
- Patients: NO access.

`doctor_presence` and `chat_read_cursors`:
- **MUST** include org_id in RLS condition to prevent cross-org leakage.

`office_settings`:
- **SELECT**: org_id match, any authenticated org member.
- **UPDATE**: org_id match + role admin/super_admin + WITH CHECK.

**MUST NOT** use `SECURITY DEFINER` functions to resolve any RLS permission issue. If a lookup is needed (e.g., resolving patient_id to profile_id), use a subquery with `SECURITY INVOKER` or inline the join.

**MUST** run `supabase db advisors` after migration 004 and resolve any HIGH or CRITICAL advisory before merging.

### Acceptance Scenarios

**Scenario 2.1 — Doctor cannot access another org's records**
- Given doctor A is authenticated with org_id = OrgA
- When doctor A queries `nodo_clinica.clinical_records`
- Then only records where `clinical_records.org_id = OrgA` are returned

**Scenario 2.2 — Patient reads only own PHI**
- Given patient P is authenticated (auth.uid = P)
- When patient P queries `nodo_clinica.clinical_records`
- Then only records linked to patient P's patient row are returned
- And records for other patients return 0 rows (no error)

**Scenario 2.3 — Patient cannot write PHI**
- Given patient P is authenticated
- When patient P attempts INSERT into `nodo_clinica.clinical_records`
- Then RLS blocks the insert (0 rows affected, no error thrown)

**Scenario 2.4 — Patient can update own health profile**
- Given patient P is authenticated
- When patient P sends UPDATE to `nodo_clinica.patient_health_profiles` for their own row
- Then the update succeeds

**Scenario 2.5 — payment_credentials inaccessible to authenticated**
- Given any authenticated user (doctor or patient)
- When they query `nodo_clinica.payment_credentials`
- Then 0 rows are returned (RLS blocks, not permission error)

**Scenario 2.6 — Doctor cannot delete clinical records (unless super_admin)**
- Given a doctor with role=admin is authenticated
- When they attempt DELETE on `nodo_clinica.clinical_records`
- Then 0 rows are deleted

**Scenario 2.7 — No unauthenticated access**
- Given an unauthenticated request (anon role)
- When they query any `nodo_clinica.*` table
- Then 0 rows are returned across all tables

---

## Domain 3: Authentication

### Requirements

**MUST** replace cookie-based session (`clinica_session`) with Supabase Auth sessions.

**MUST** replace plaintext password comparison (`d.password === password`) with `supabase.auth.signInWithPassword`.

**MUST** remove `x-clinic-*` header bypass entirely. No route may accept these headers as an authentication mechanism.

**MUST** implement doctor registration flow:
- `supabase.auth.signUp` creates the auth.users row.
- An `shared.org_members` row is inserted with `role = 'admin'` and the org's id.
- The `custom_access_token_hook` then injects `org_id` and `role` into subsequent JWTs automatically.

**MUST** implement patient self-registration flow:
- `supabase.auth.signUp` creates the auth.users row.
- A `nodo_clinica.patients` row is inserted linking `profile_id = auth.uid()`.
- NO `shared.org_members` row is created for the patient.
- Patient JWT contains NO `org_id` claim and NO `role` claim from the hook.

**MUST** use `@supabase/ssr` for all server-side session handling in Next.js API routes.

**MUST** use `createServerClient` (from `@supabase/ssr`) in API route handlers, not the browser client.

**MUST NOT** store the Supabase `service_role` key in any `NEXT_PUBLIC_*` env variable.

**SHOULD** implement a feature flag `USE_SUPABASE_AUTH=true` in `.env.local` to allow rollback to cookie auth during transition. When the flag is false, the old cookie session is used. When true, Supabase Auth is active.

**MUST** support password recovery via Supabase Auth email recovery (no custom implementation needed).

### Acceptance Scenarios

**Scenario 3.1 — Doctor login**
- Given a doctor has a valid Supabase Auth account and is an org member
- When they POST to `/api/auth/login` with valid credentials
- Then the response sets a Supabase session cookie and returns a user object with `role: 'admin'`

**Scenario 3.2 — Patient login**
- Given a patient has a valid Supabase Auth account
- When they POST to `/api/auth/login` with valid credentials
- Then the response sets a Supabase session cookie
- And the returned user object has no `org_id` claim

**Scenario 3.3 — Unauthenticated route rejection**
- Given a request with no valid session cookie
- When they call any protected API route
- Then the response is HTTP 401

**Scenario 3.4 — x-clinic-* header no longer works**
- Given a request with `x-clinic-user-id: any-value` header but no valid session
- When they call any API route
- Then the response is HTTP 401 (header is ignored)

**Scenario 3.5 — Patient cannot access doctor routes**
- Given a patient is authenticated (no org_id claim)
- When they call a doctor-only API route (e.g., `/api/professionals`)
- Then the response is HTTP 403

---

## Domain 4: API Routes — Batch 1 (patients, appointments, clinical-records)

### Requirements

**MUST** replace all `readDb` and `writeDb` calls in the following route groups with Supabase client calls:
- `/api/patients/**` (patient CRUD, health profiles)
- `/api/appointments/**` (appointment CRUD, reminders)
- `/api/clinical-records/**` (records, notes, SOAP, prescriptions, study orders)

**MUST** authenticate every request via Supabase session before any DB operation. Unauthenticated requests return HTTP 401 before any query executes.

**MUST** use the server-side Supabase client (with session from cookie) so RLS is applied using the caller's JWT. MUST NOT use `service_role` client for regular data access in these routes.

**MUST** validate that the `nodo_clinica.patients.org_id` on insert matches the doctor's JWT `org_id` claim. A doctor MUST NOT be able to register a patient under a different org.

**MUST** delete `nodo_clinica/src/lib/clinic/local-db.ts` and `nodo_clinica/src/lib/clinic/session.ts` after all routes in both batches are migrated. These files MUST NOT exist after migration is complete.

**SHOULD** create `nodo_clinica/src/lib/supabase/server.ts` exporting a `createSupabaseServerClient(req, res)` helper using `@supabase/ssr`'s `createServerClient`.

### Acceptance Scenarios

**Scenario 4.1 — Create appointment**
- Given a doctor is authenticated
- When POST `/api/appointments` with a valid patient_id and datetime
- Then an `appointments` row is inserted with `org_id` matching the doctor's JWT org_id

**Scenario 4.2 — Doctor cannot create appointment for another org's patient**
- Given doctor A (org OrgA) is authenticated
- When POST `/api/appointments` with a `patient_id` that belongs to OrgB
- Then the insert is rejected (RLS blocks it) and HTTP 422 or 403 is returned

**Scenario 4.3 — Clinical record creation**
- Given a doctor is authenticated
- When POST `/api/clinical-records` with valid patient_id and content
- Then a `clinical_records` row is inserted and RLS allows it (org_id matches)

**Scenario 4.4 — readDb/writeDb gone**
- Given Batch 1 is merged
- When running `rg "readDb|writeDb"` in `/api/patients/`, `/api/appointments/`, `/api/clinical-records/`
- Then 0 matches are found

---

## Domain 5: API Routes — Batch 2 (interconsult, MercadoPago, admin)

### Requirements

**MUST** replace all `readDb` and `writeDb` calls in the following route groups:
- `/api/interconsult/**`
- `/api/payments/**` and `/api/mercadopago/**`
- `/api/admin/**`
- All remaining API route files not covered in Batch 1

**MUST** migrate MercadoPago OAuth tokens:
- Access token, refresh token, and public key MUST be read from `nodo_clinica.payment_credentials` via `service_role` client only.
- The `office_settings.payment` JSONB column MUST be cleaned of OAuth token fields after migration.
- Client-side code (frontend) MUST NOT have access to the access token or refresh token.

**MUST** ensure all interconsult message routes validate that both `from_professional_id` and `to_professional_id` exist in `nodo_clinica.professionals` before insert (enforced by FK, but route should return a meaningful 422 if violated).

**MUST** remove any hardcoded `ECOSYSTEM_PRO_CONTACTS` from ecosystem-directory logic. If cross-org messaging is still needed, it MUST use `nodo_clinica.professionals` queries, not hardcoded arrays.

**MUST** ensure admin routes verify `role = 'super_admin'` from JWT claims (not from a request body or header).

### Acceptance Scenarios

**Scenario 5.1 — MercadoPago token not in API response**
- Given any authenticated API route that returns office settings
- When the response is inspected
- Then `access_token`, `refresh_token`, and `public_key` fields are NOT present in the response body

**Scenario 5.2 — No hardcoded ecosystem contacts**
- Given Batch 2 is merged
- When running `rg "ECOSYSTEM_PRO_CONTACTS"` in the codebase
- Then 0 matches are found

**Scenario 5.3 — readDb/writeDb fully removed**
- Given both Batch 1 and Batch 2 are merged
- When running `rg "readDb|writeDb"` across the entire `nodo-clinica/src/app/api/` directory
- Then 0 matches are found
- And `local-db.ts` does not exist

---

## Domain 6: Scaffold Compliance

### Requirements

**MUST** fix port mismatch: `nodo-landing/next.config.ts` proxy for `/nodo-clinica/:path*` MUST point to the actual running port of nodo-clinica (currently 3002, not 5174). The env var `NODO_CLINICA_URL` MUST be updated in documentation and `.env.local.example`.

**MUST** create `nodo-clinica/src/shared/hooks/use-theme-settings.ts` following the nodo-scaffold pattern with `STORAGE_KEY = "nodo-clinica-theme-settings"` and `brandText: "nodo clinica"`.

**MUST** create `nodo-clinica/src/shared/hooks/use-clinica-theme-sync.ts` with load (from `office_settings.theme_settings`) and save functions.

**MUST** wire `ThemeInitializer` (calling `useClinicaThemeSync` + `useThemeSettings`) into the app providers, inside `AuthProvider`.

**MUST** add `@import "@nodocore/shared-components/styles/interactive.css"` to `nodo-clinica/src/index.css` (or equivalent global CSS entry point).

**SHOULD** integrate `@nodocore/shared-components` Auth and UI components. Where existing components duplicate functionality (login form, button, avatar), they SHOULD be replaced with shared-components equivalents.

**MAY** defer full nodo-modules integration (agenda/caja) to a future change.

**MUST NOT** rewrite nodo-clinica as a Vite SPA. Next.js is retained for server-side API routes, webhook handlers, and AI/video integrations.

### Acceptance Scenarios

**Scenario 6.1 — Theme sync on load**
- Given an admin doctor logs in
- When the app loads
- Then `office_settings.theme_settings` is fetched from Supabase and the CSS custom properties on `:root` reflect the stored values

**Scenario 6.2 — Theme save on dialog close**
- Given an admin doctor changes a theme setting in the settings dialog
- When the dialog is closed
- Then `office_settings.theme_settings` is updated in Supabase

**Scenario 6.3 — Port proxy works**
- Given nodo-clinica is running on port 3002
- When a browser navigates to `/nodo-clinica/login` on the landing port
- Then the request is proxied correctly (no 502/connection refused)

**Scenario 6.4 — Cursor pointer on interactive elements**
- Given any clickable button or nav item in nodo-clinica
- When the user hovers over it
- Then the cursor is a pointer (hand icon)

---

## Cross-Cutting Requirements

### Security (PHI)

**MUST** ensure all tables classified as PHI (`clinical_records`, `clinical_notes`, `prescriptions`, `soap_summaries`, `study_orders`, `patient_documents`, `patient_health_profiles`) have:
1. RLS enabled.
2. At least one explicit SELECT policy (no implicit allow-all).
3. No `SECURITY DEFINER` helper functions used for access control.
4. Been reviewed via `supabase db advisors` with no HIGH/CRITICAL advisories.

**MUST NOT** log PHI content to application logs or error tracking services (no full record bodies in logs).

**MUST NOT** return PHI fields in error responses.

### Performance

**MUST** add indexes on all FK columns in `nodo_clinica.*` tables where they are used as query filters (e.g., `appointments.patient_id`, `clinical_records.patient_id`, `clinical_records.org_id`).

**SHOULD** use `(select auth.uid())` (scalar subquery) rather than bare `auth.uid()` in RLS policies to prevent per-row function re-evaluation. Same pattern for `auth.jwt()` lookups.

### Rollback

**MUST** implement feature flag `USE_SUPABASE_AUTH=true` in environment. When false, legacy cookie auth is used (transition safety).

**MUST** ensure each PR (migration, auth, batch 1, batch 2, scaffold) is independently revertable without breaking other merged PRs. Migration rollbacks via SQL `down` scripts or `supabase db reset`.

### Completeness

**MUST** result in 0 remaining `readDb` or `writeDb` call-sites across the entire `nodo-clinica` codebase after Batch 2 merges.

**MUST** result in every `nodo_clinica.*` table having at least one RLS policy after Migration 004 merges.

---

## Out of Scope (must NOT be spec'd here)

- Supabase Realtime for chat/presence (future change)
- Cross-org interconsult directory (ecosystem contacts architecture)
- nodo-modules (agenda/caja) integration
- Patient-facing mobile app
- Rewrite to Vite SPA
