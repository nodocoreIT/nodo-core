# Design: nodo-clinica Supabase Integration

## Technical Approach

Migrate nodo-clinica from JSON-file DB + plaintext cookie auth to the shared Supabase project. Keep Next.js (server routes needed for webhooks, video, AI). Follow nodo-landing's `@supabase/ssr` pattern for client setup. Apply nodo-inmo's RLS pattern with a dual-model extension: doctors use org_id JWT claim (Template A), patients use auth.uid() (Template P). 6 chained PRs, each independently testable.

## Architecture Decisions

### ADR-1: Supabase Client Pattern

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Copy nodo-landing pattern (`@supabase/ssr` + cookie adapter) | Proven in monorepo, handles SSR + API routes | **CHOSEN** |
| Use `@nodocore/shared-components` Supabase factory | Only works for Vite SPAs, not Next.js server | Rejected |
| Raw `@supabase/supabase-js` without SSR | No cookie-based session refresh in middleware | Rejected |

**Implementation**: Keep existing `nodo-clinica/src/lib/supabase/{client.ts, server.ts, middleware.ts}`. They already match nodo-landing's pattern. Changes needed:
- Remove `isLocalMode()` guard from middleware.ts — always use Supabase.
- Add `clinicaSupabaseClientOptions` with `db: { schema: "nodo_clinica" }` and `cookieOptions: { name: "nodo-auth-clinica" }` (mirrors nodo-landing's `panel-auth.ts`).
- `createServiceClient()` in server.ts already exists — use for MercadoPago token access.

### ADR-2: Dual RLS Model

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Template A (org_id) for doctors + Template P (auth.uid()) for patients | Two distinct policy sets per table, more SQL but correct access model | **CHOSEN** |
| Single org_id model with patients as org_members | Patients get JWT org_id claim, nodo-switcher access — wrong semantically | Rejected |
| Service-role-only API routes (no RLS) | No defense in depth, single point of failure | Rejected |

**Template A (doctor/staff)** — identical to nodo-inmo:
```sql
create policy "staff_select" on nodo_clinica.{table}
  for select to authenticated
  using (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
```

**Template P (patient)** — new pattern:
```sql
create policy "patient_select" on nodo_clinica.patients
  for select to authenticated
  using (profile_id = (select auth.uid()));
-- Patient sees ONLY their own row. No org_id in JWT.
```

For tables like appointments, clinical_records where both doctors AND patients need access:
```sql
-- Doctor sees all org appointments
create policy "staff_select" on nodo_clinica.appointments for select to authenticated
  using (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
-- Patient sees only their own appointments
create policy "patient_select" on nodo_clinica.appointments for select to authenticated
  using (patient_id in (
    select id from nodo_clinica.patients where profile_id = (select auth.uid())
  ));
```

Both policies are additive (OR semantics in Postgres RLS). A user matching EITHER policy gets access.

### ADR-3: Auth Migration Strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Feature flag `USE_SUPABASE_AUTH` env var | Allows rollback to cookie auth during transition | **CHOSEN** |
| Hard cutover in single PR | No rollback path, risky with 33 routes | Rejected |
| Dual-write (both systems simultaneously) | Complex, data sync issues | Rejected |

**Doctor registration**: `supabase.auth.signUp()` → insert `shared.org_members` (role='admin') → insert `nodo_clinica.professionals`. The custom_access_token_hook populates org_id in JWT automatically.

**Patient registration**: `supabase.auth.signUp()` → insert `nodo_clinica.patients` with `profile_id = auth.uid()`. NO org_members row. Patient gets no org_id in JWT — auth.uid() is sufficient for RLS.

**Session replacement**: Remove `getSessionFromRequest()` / cookie-based session. Replace with `supabase.auth.getUser()` in API routes. Middleware `updateSession()` handles token refresh.

### ADR-4: API Route Migration — Service Layer

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Thin service layer with typed query helpers | Moderate abstraction, reusable, testable | **CHOSEN** |
| Inline Supabase calls per route | Fastest to write, but 126 call-sites with duplicated error handling | Rejected |
| Full repository pattern | Over-engineered for Next.js API routes | Rejected |

**Pattern**: Create `nodo-clinica/src/lib/clinic/db/` with domain modules:
- `patients.ts` — CRUD queries for patients table
- `appointments.ts` — CRUD + status transitions
- `clinical-records.ts` — records, notes, SOAP, transcriptions
- `documents.ts` — Storage upload/download with signed URLs
- `payments.ts` — MercadoPago credential access (service_role)

Each module exports typed async functions that accept a Supabase client. API routes become thin: auth check → call service → return response.

### ADR-5: MercadoPago Token Isolation

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Separate `payment_credentials` table, service_role-only RLS | Clean isolation, no authenticated access to tokens | **CHOSEN** |
| Supabase Vault | Not available in shared project, adds operational complexity | Rejected |
| Keep in office_settings JSONB but encrypt | Still accessible via RLS if office_settings is readable | Rejected |

```sql
create table nodo_clinica.payment_credentials (
  professional_id uuid primary key references nodo_clinica.professionals(id),
  org_id uuid not null references shared.organizations(id),
  access_token text, refresh_token text, token_expires_at timestamptz,
  user_id text, public_key text, connected_at timestamptz,
  external_pos_id text,
  updated_at timestamptz not null default now()
);
alter table nodo_clinica.payment_credentials enable row level security;
-- NO policies for authenticated — only service_role can read/write
```

API routes that need MP tokens use `createServiceClient()`.

### ADR-6: Realtime for Interconsult

| Decision | **Deferred — out of scope per proposal** |
|----------|------------------------------------------|

Current polling stays. Realtime migration is a separate SDD change after base migration is complete.

### ADR-7: Patient Documents — Storage Migration

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Supabase Storage bucket `patient-documents` with signed URLs | Standard pattern, integrates with RLS on storage | **CHOSEN** |
| Keep base64 in DB | Bloats DB, no CDN, poor performance | Rejected |

Storage bucket defined in migration 003. Upload via `createServiceClient()` (bypass storage RLS for server-side uploads). Download via signed URLs generated server-side and returned to client.

### ADR-8: PHI Security Measures

Beyond RLS:
1. **Schema isolation**: `nodo_clinica` schema with explicit grants (migration 003).
2. **No SECURITY DEFINER on PHI tables** — all functions SECURITY INVOKER.
3. **Audit columns**: `created_at` on all PHI tables (already present).
4. **Service-role gating**: MercadoPago tokens, bulk exports, and admin operations use service_role client only.
5. **Row-level audit trail**: Future consideration (pg_audit or trigger-based), not in this migration.
6. **Storage policies**: patient-documents bucket requires authenticated + path-based policy matching `{org_id}/{patient_id}/*`.

## Data Flow

```
Browser (doctor)                    Browser (patient)
     │                                    │
     ▼                                    ▼
  Middleware (updateSession)         Middleware (updateSession)
     │ refreshes Supabase cookie         │ refreshes Supabase cookie
     ▼                                    ▼
  API Route                          API Route
     │ createClient() from server.ts      │ createClient() from server.ts
     │ supabase.auth.getUser()            │ supabase.auth.getUser()
     │ JWT has org_id claim               │ JWT has NO org_id claim
     ▼                                    ▼
  Service Layer (db/*.ts)            Service Layer (db/*.ts)
     │ supabase.from('table')...          │ supabase.from('table')...
     ▼                                    ▼
  Supabase (nodo_clinica schema)     Supabase (nodo_clinica schema)
     │ RLS Template A (org_id)            │ RLS Template P (auth.uid)
     ▼                                    ▼
  Returns org-scoped rows            Returns patient's own rows
```

For MercadoPago operations:
```
API Route → createServiceClient() → payment_credentials (bypasses RLS) → MP API
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `nodo-clinica/supabase/migrations/003_*.sql` | Create | Schema grants, FK fixes, storage bucket, missing tables, theme_settings fix |
| `nodo-clinica/supabase/migrations/004_*.sql` | Create | Complete RLS policies (Template A + Template P) |
| `nodo-clinica/src/lib/supabase/clinica-auth.ts` | Create | `clinicaSupabaseClientOptions` (schema + cookie name) |
| `nodo-clinica/src/lib/supabase/middleware.ts` | Modify | Remove `isLocalMode()`, add clinica auth options |
| `nodo-clinica/src/lib/supabase/server.ts` | Modify | Add clinica auth options |
| `nodo-clinica/src/lib/supabase/client.ts` | Modify | Add clinica auth options, singleton pattern |
| `nodo-clinica/src/lib/clinic/db/patients.ts` | Create | Patient CRUD service |
| `nodo-clinica/src/lib/clinic/db/appointments.ts` | Create | Appointment CRUD + status service |
| `nodo-clinica/src/lib/clinic/db/clinical-records.ts` | Create | Records, notes, SOAP service |
| `nodo-clinica/src/lib/clinic/db/documents.ts` | Create | Storage upload/download service |
| `nodo-clinica/src/lib/clinic/db/payments.ts` | Create | MercadoPago credential service (service_role) |
| `nodo-clinica/src/lib/clinic/db/professionals.ts` | Create | Doctor/professional CRUD service |
| `nodo-clinica/src/app/api/clinic/account/login/route.ts` | Modify | Replace plaintext auth with supabase.auth.signInWithPassword |
| `nodo-clinica/src/app/api/clinic/account/register/route.ts` | Modify | Replace plaintext with supabase.auth.signUp + org_members/patients insert |
| `nodo-clinica/src/app/api/clinic/account/session/route.ts` | Modify | Replace cookie read with supabase.auth.getUser() |
| `nodo-clinica/src/app/api/**/*.ts` (33 files) | Modify | Replace readDb/writeDb with service layer calls |
| `nodo-clinica/src/lib/clinic/local-db.ts` | Delete | Replaced by Supabase (after all routes migrated) |
| `nodo-clinica/src/lib/clinic/session.ts` | Delete | Replaced by Supabase Auth |
| `nodo-clinica/src/shared/hooks/use-theme-settings.ts` | Create | Scaffold-compliant theme settings |
| `nodo-clinica/src/shared/hooks/use-clinica-theme-sync.ts` | Create | Theme sync from office_settings |
| `nodo-landing/next.config.ts` | Modify | Fix port alignment for clinica proxy |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| SQL | RLS policies (Template A + P) | pgTAP tests: set role, set JWT claims, verify SELECT/INSERT/UPDATE/DELETE for doctor vs patient vs unauthenticated |
| Integration | Auth flows (doctor + patient registration/login) | Manual smoke test per PR; verify JWT claims present/absent |
| Integration | API routes return correct data per role | Manual test with doctor session vs patient session |
| Security | PHI tables inaccessible without auth | pgTAP: anon role SELECT returns 0 rows |
| Security | payment_credentials inaccessible to authenticated | pgTAP: authenticated SELECT returns 0 rows |

## Migration / Rollout

1. **PR 1-2** (migrations): Apply to shared Supabase. No app code changes. Rollback = `supabase db reset`.
2. **PR 3** (auth): Feature flag `USE_SUPABASE_AUTH=true`. Toggle env var to rollback to cookie auth.
3. **PR 4-5** (API routes): Each batch independently revertable. Feature flag covers auth layer.
4. **PR 6** (scaffold): Theme sync + landing proxy. Independent of API route PRs.

## Open Questions

- [ ] Should `nodo_clinica.patients.org_id` be required? Patients register for a specific clinic (org), so yes — but a patient could visit multiple clinics. Current schema has org_id NOT NULL with UNIQUE(org_id, email). This means same patient email in two clinics = two patient rows. Acceptable for MVP; cross-clinic patient identity is a future concern.
- [ ] Appointment reminder cron (`/api/cron/appointment-reminders`): keep as Next.js API route or move to pg_cron? Keep as Next.js for now — it sends emails via Resend which needs server-side API key.
