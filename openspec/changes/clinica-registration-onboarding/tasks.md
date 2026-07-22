# Tasks: clinica-registration-onboarding

**Delivery strategy**: single-pr (branch `nodo_clinica`)
**Password strategy**: magic-link-only. No password is set during registration or onboarding. Users log in via magic link from the dashboard login page. The `login()` method in `client-api.ts` (password-based) remains untouched — it serves existing authenticated users.

---

## Dependency Order

```
T1 (migration)
  └─> T2 (mail module)
        └─> T3 (register route — modify)
              └─> T4 (verify route — new)
                    ├─> T5 (onboarding/medico route — new)
                    │     └─> T7 (onboarding/medico page — new)
                    └─> T6 (onboarding/paciente route — new)
                          └─> T8 (onboarding/paciente page — new)
T9 (registro pages — can start after T3 is merged)
T10 (client-api — can start after T3; unblocks T9)
```

T5 and T6 are parallel (no shared state). T7 and T8 are parallel. T9 and T10 are parallel after T3.

---

## Tasks

### [x] T1 — Database migration

**File**: `nodo-clinica/supabase/migrations/20260711_clinica_registration.sql`
**Spec**: clinic-email-registration REQ-1, clinic-token-verification REQ-1
**Parallel**: no — everything depends on schema

**What to implement**:
1. Create table `nodo_clinica.pending_clinic_registrations`:
   ```sql
   CREATE TABLE nodo_clinica.pending_clinic_registrations (
     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     email       text NOT NULL,
     role        text NOT NULL CHECK (role IN ('medico', 'paciente')),
     token       uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
     expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
     verified_at timestamptz,
     created_at  timestamptz NOT NULL DEFAULT now()
   );
   -- Prevents duplicate pending registrations for the same email+role combo
   CREATE UNIQUE INDEX pending_clinic_registrations_email_role_unverified
     ON nodo_clinica.pending_clinic_registrations (email, role)
     WHERE verified_at IS NULL;
   ```
2. Enable RLS on `pending_clinic_registrations`; service role bypasses RLS (no user-facing policies needed).
3. Create Storage bucket `clinic-registration-docs` (public: false).
4. Add Storage RLS policy: authenticated users can INSERT/SELECT objects where `(storage.foldername(name))[1] = auth.uid()::text`.
5. No ALTER on `professionals` or `patients` is required unless the design calls for new columns. Verify existing columns match what the onboarding routes will insert (see T5/T6). If columns are missing, add them here.

**Acceptance criteria**:
- Migration runs cleanly with `supabase db push` or SQL Editor.
- `UNIQUE INDEX` prevents two pending rows for the same `(email, role)` when both are unverified.
- Storage bucket exists; unauthenticated uploads return 403.

---

### [x] T2 — Mail module

**File**: `nodo-clinica/src/lib/mail.ts` (new)
**Spec**: clinic-email-registration REQ-2, REQ-3
**Parallel**: after T1 (no DB dependency — can actually run in parallel with T1 since it has no schema dependency; implementer can start immediately)

**What to implement**:
Standalone Nodemailer module. Mirror the pattern from `nodo-landing/lib/mail.ts` exactly (same env vars, same transport setup). Do NOT import from nodo-landing.

```typescript
import "server-only";
import nodemailer from "nodemailer";

const HOST = process.env.ZOHO_SMTP_HOST ?? "smtp.zoho.com";
const PORT = Number(process.env.ZOHO_SMTP_PORT ?? 465);
const USER = process.env.ZOHO_SMTP_USER;
const PASS = process.env.ZOHO_SMTP_PASSWORD;

export function isMailConfigured(): boolean { ... }

export async function sendClinicVerificationEmail(params: {
  email: string;
  role: 'medico' | 'paciente';
  token: string;
  origin: string;
}): Promise<void>
```

- The verification URL must be: `${origin}/api/clinic/account/verify?token=${token}&role=${role}`
- HTML template uses teal branding: CTA button color `#0D9488` (Tailwind `teal-600`)
- Subject: `"Verificá tu cuenta en NODO | Clínica"`
- No logo attachment needed (nodo-clinica has no `/public/logos/` directory unless confirmed)
- If `!isMailConfigured()`, throw with message: `"SMTP not configured: set ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD"`
- The function must be callable from server-only route handlers (the `"server-only"` import enforces this)

**Unit test** (Strict TDD — write test first):
- File: `nodo-clinica/src/lib/mail.test.ts`
- Mock nodemailer transport; assert `sendMail` is called with correct `to`, `subject`, and that `html` contains the teal CTA color `#0D9488` and the full verification URL including `token` and `role` query params.

**Acceptance criteria**:
- `isMailConfigured()` returns `false` when env vars are absent; function throws.
- `sendClinicVerificationEmail` calls nodemailer with the correct URL including both `token` and `role`.
- Unit test passes.

---

### [x] T3 — Modify register route

**File**: `nodo-clinica/src/app/api/clinic/account/register/route.ts`
**Spec**: clinic-email-registration REQ-1 through REQ-4
**Parallel**: after T1 + T2

**What to implement**:
Replace the monolithic `registerDoctor` / `registerPatient` logic entirely. The new handler:

1. Parses body: `{ email: string; role: 'medico' | 'paciente' }`. Rejects if either is missing (400).
2. Validates `role` is exactly `'medico'` or `'paciente'`; rejects anything else (400).
3. Uses `createServiceClient()` to insert into `nodo_clinica.pending_clinic_registrations`:
   - On unique constraint violation (duplicate pending email+role): return 409 `{ error: "Ya hay una verificación pendiente para este email. Revisá tu correo o esperá 24 horas." }`
   - On other DB errors: return 500.
4. Calls `sendClinicVerificationEmail({ email, role, token, origin })` where `origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_BASE_URL ?? ''`.
   - If SMTP is not configured: log warning, still return 200 (don't block registration in dev without SMTP). Log the verification URL to console for local testing.
5. Returns `200 { ok: true }`.

Remove all signUp, org_members, professionals, and patients logic from this file. The old `CLINIC_ORG_ID` constant can be removed (it moves to the onboarding routes).

**Acceptance criteria**:
- POST `{ email: "x@y.com", role: "medico" }` → inserts pending row, sends email, returns `{ ok: true }`.
- POST with same email+role while unverified → 409.
- POST with missing role → 400.
- No password field accepted or required.

---

### [x] T4 — Verify route

**File**: `nodo-clinica/src/app/api/clinic/account/verify/route.ts` (new)
**Spec**: clinic-token-verification REQ-1, REQ-2, REQ-3
**Parallel**: after T3

**What to implement**:
GET handler. Query params: `token` (UUID string), `role` ('medico' | 'paciente').

Steps (all via `createServiceClient()`):

1. Validate params present; if missing → redirect to `/registro/{role}?error=invalid_link`.
2. Fetch pending row: `SELECT * FROM nodo_clinica.pending_clinic_registrations WHERE token = $token`.
   - Not found → redirect `/registro/{role}?error=invalid_token`
   - `verified_at IS NOT NULL` → redirect `/registro/{role}?error=already_used`
   - `expires_at < now()` → redirect `/registro/{role}?error=expired`
   - `role` param does not match `row.role` → redirect `/login?error=role_mismatch`
3. Create auth user: `supabase.auth.admin.createUser({ email: row.email, email_confirm: true })`.
   - If user already exists (error code `"email_exists"` or similar): treat as success — the user already verified; proceed to generate magic link.
4. Mark token used: `UPDATE ... SET verified_at = now() WHERE id = row.id`.
5. Generate magic link: `supabase.auth.admin.generateLink({ type: 'magiclink', email: row.email, options: { redirectTo: \`/onboarding/${row.role}\` } })`.
6. Redirect to the `action_link` returned by `generateLink`. This URL hits `/auth/v1/verify` which sets session cookies and then redirects to `/onboarding/{role}`.

**Error recovery**: steps 3–6 should be attempted atomically in intent — if step 5 (generateLink) fails, still mark token used (step 4 already ran) and redirect to `/login?error=session_error` so the user can log in manually via magic link from the login page.

**Acceptance criteria**:
- Valid token → user exists in `auth.users`, `verified_at` is set, browser lands on `/onboarding/{role}` with active session.
- Expired token → redirect with `?error=expired`.
- Already-used token → redirect with `?error=already_used`.
- Role mismatch between query param and DB row → redirect with `?error=role_mismatch`.

---

### [x] T5 — Onboarding API route: medico

**File**: `nodo-clinica/src/app/api/clinic/account/onboarding/medico/route.ts` (new)
**Spec**: clinic-onboarding REQ-1, REQ-3
**Parallel**: after T4; parallel with T6

**What to implement**:
POST handler, JSON body.

```typescript
body: {
  fullName: string;
  specialty: string;
  licenseNumber: string;
  plan: 'trial' | 'basico' | 'profesional';
}
```

1. Auth guard: use existing `createClient()` + `getUser()`. If no authenticated user → 401.
2. Use `createServiceClient()` for all DB writes.
3. Insert into `nodo_clinica.professionals`:
   ```
   user_id, org_id (CLINIC_ORG_ID), full_name, email, specialty, license_number,
   subscription_status: 'trial', subscription_plan: plan
   ```
4. Insert into `shared.org_members`: `{ user_id, org_id: CLINIC_ORG_ID, role: 'admin' }`.
5. On duplicate `user_id` in either table → return 409 `{ error: "Onboarding already completed" }`.
6. Return `200 { ok: true }`.

`CLINIC_ORG_ID` stays as env var: `process.env.CLINIC_ORG_ID ?? "843524dc-0c3b-4340-bc8e-e3ae5aa00fd2"`.

**Acceptance criteria**:
- Authenticated POST with valid body → row in `professionals`, row in `org_members`, 200.
- Unauthenticated request → 401.
- Duplicate submission (user already onboarded) → 409.

---

### [x] T6 — Onboarding API route: paciente

**File**: `nodo-clinica/src/app/api/clinic/account/onboarding/paciente/route.ts` (new)
**Spec**: clinic-onboarding REQ-2, REQ-4
**Parallel**: after T4; parallel with T5

**What to implement**:
POST handler, `FormData` body.

FormData keys: `fullName` (string), `address` (string, optional), `obraSocial` (string, optional), `plan` ('gratuito' | 'pago'), `dniFront` (File, optional), `dniBack` (File, optional).

1. Auth guard: same pattern as T5.
2. Upload DNI files (if provided) to Storage bucket `clinic-registration-docs`:
   - Path: `{auth.uid()}/dni_front.{ext}` and `{auth.uid()}/dni_back.{ext}`
   - Use `createServiceClient()` for the upload (bypasses RLS; service role has full storage access).
   - If upload fails → return 500 without inserting patient row (atomic intent: no partial record).
3. Insert into `nodo_clinica.patients`:
   ```
   profile_id: auth.uid(), org_id: CLINIC_ORG_ID, full_name, email (from auth.user.email),
   address, obra_social: obraSocial, subscription_plan: plan,
   dni_front_path, dni_back_path (Storage paths, nullable)
   ```
   - **Note for implementer**: if `address`, `obra_social`, `dni_front_path`, `dni_back_path` columns do not exist in `nodo_clinica.patients`, add them to T1 migration. Check existing schema before implementing.
4. Return `200 { ok: true }`.

**Acceptance criteria**:
- With DNI files: files appear in Storage under `{uid}/`, patient row has storage paths, 200.
- Without DNI files: patient row inserted with null paths, 200.
- Upload failure: no patient row created, 500 returned.
- Unauthenticated → 401.

---

### [x] T7 — Onboarding page: medico

**File**: `nodo-clinica/src/app/onboarding/medico/page.tsx` (new)
**Spec**: clinic-onboarding REQ-1
**Parallel**: after T5; parallel with T8

**What to implement**:
`"use client"` page. Auth guard via `useEffect` + `clinicApi.getSession()` — redirect to `/login/medico` if no session.

Form fields:
- `fullName` (text, required)
- `specialty` (use existing `SpecialtyCombobox` from `@/components/ui/specialty-combobox`)
- `licenseNumber` (text, optional)
- Plan cards: Trial / Básico / Profesional (reuse the `PLANS` array from the old `registro/medico/page.tsx`)

On submit: call `clinicApi.completeOnboardingMedico({ fullName, specialty, licenseNumber, plan })`. On success: `window.location.href = '/medico/dashboard'`. On error: `toast.error(...)`.

Teal branding: icon background `bg-teal-600`, primary button `bg-teal-600 hover:bg-teal-700`, plan card selected state `border-teal-500 bg-teal-50 ring-teal-200`.

Show loading skeleton while session check is in flight (no content flash).

**Acceptance criteria**:
- Unauthenticated visit → redirect to `/login/medico`.
- Authenticated submit → calls API, redirects to dashboard on success.
- Form renders plan cards; selected plan is visually distinct.

---

### [x] T8 — Onboarding page: paciente

**File**: `nodo-clinica/src/app/onboarding/paciente/page.tsx` (new)
**Spec**: clinic-onboarding REQ-2
**Parallel**: after T6; parallel with T7

**What to implement**:
`"use client"` page. Same auth guard pattern as T7 (redirect to `/login/paciente`).

Form fields:
- `fullName` (text, required)
- `address` (text, optional)
- `obraSocial` (text, optional)
- `dniFront` (file input, accept image/*, optional) — label: "DNI frente"
- `dniBack` (file input, accept image/*, optional) — label: "DNI dorso"
- Plan cards: Gratuito / Pago

On submit: build `FormData`, call `clinicApi.completeOnboardingPaciente(formData)`. On success: `window.location.href = '/paciente'`. On error: `toast.error(...)`.

Same teal branding as T7.

**Acceptance criteria**:
- Unauthenticated → redirect to `/login/paciente`.
- File inputs accept images; files are included in FormData submission.
- Success → redirect to `/paciente`.

---

### [x] T9 — Modify registro pages (medico + paciente)

**Files**:
- `nodo-clinica/src/app/registro/medico/page.tsx`
- `nodo-clinica/src/app/registro/paciente/page.tsx`
**Spec**: clinic-email-registration REQ-1, REQ-2
**Parallel**: after T10 (client-api must expose new `register()` signature first); T9 and T10 can be done in a single commit

**What to implement** (both pages follow the same pattern):

Replace the full-form UI with an email-only form:

**registro/medico/page.tsx**:
- State: `{ email: string }` + `submitted: boolean`
- On submit: `clinicApi.register({ email, role: 'medico' })` → set `submitted = true`
- Success state: display "Revisá tu correo" message with teal icon; no redirect
- Error: `toast.error(...)`
- Remove all fields: `fullName`, `password`, `specialty`, `licenseNumber`, plan cards
- Teal branding throughout (replace blue-700 with teal-600)

**registro/paciente/page.tsx**:
- Same pattern: email-only, role: 'paciente', teal branding
- Remove: `fullName`, `password`, `phone`

**Acceptance criteria**:
- Submit with valid email → API called with `{ email, role }`, success state shown.
- No password field present in either page.
- Teal color scheme applied (no blue-700 or emerald-600 for primary actions).

---

### [x] T10 — Update client-api.ts

**File**: `nodo-clinica/src/lib/clinic/client-api.ts`
**Spec**: clinic-email-registration REQ-1; clinic-onboarding REQ-1, REQ-2
**Parallel**: parallel with T9 (both are post-T3; can be one commit)

**What to implement**:

1. Replace `register(payload: Record<string, unknown>)` with typed signature:
   ```typescript
   async register(payload: { email: string; role: 'medico' | 'paciente' }): Promise<{ ok: boolean }>
   ```
   Remove the post-registration `signInWithPassword` block (no password exists anymore). Remove the `saveClientSession` call after register. Simplified body: just fetch + parse + throw on error.

2. Add `completeOnboardingMedico`:
   ```typescript
   async completeOnboardingMedico(data: {
     fullName: string;
     specialty: string;
     licenseNumber: string;
     plan: string;
   }): Promise<{ ok: boolean }>
   ```
   POST JSON to `/api/clinic/account/onboarding/medico`.

3. Add `completeOnboardingPaciente`:
   ```typescript
   async completeOnboardingPaciente(formData: FormData): Promise<{ ok: boolean }>
   ```
   POST FormData to `/api/clinic/account/onboarding/paciente`. No `Content-Type` header (browser sets multipart boundary automatically).

**Acceptance criteria**:
- `register()` no longer accepts or sends `password`, `fullName`, `specialty`, or `licenseNumber`.
- `completeOnboardingMedico` and `completeOnboardingPaciente` exist and are callable from onboarding pages.
- TypeScript compiles without errors (`tsc --noEmit`).

---

## Schema verification note (for T1 implementer)

Before writing the migration, check existing columns on `nodo_clinica.patients`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'nodo_clinica' AND table_name = 'patients';
```

If `address`, `obra_social`, `dni_front_path`, `dni_back_path` are missing, add:

```sql
ALTER TABLE nodo_clinica.patients
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS obra_social text,
  ADD COLUMN IF NOT EXISTS dni_front_path text,
  ADD COLUMN IF NOT EXISTS dni_back_path text,
  ADD COLUMN IF NOT EXISTS subscription_plan text;
```

Include these ALTER statements in the same migration file if needed.

---

## Review Workload Forecast

| Metric | Estimate |
|--------|----------|
| New files | 7 |
| Modified files | 3 |
| Estimated changed lines | ~600–750 |
| 400-line budget risk | High |
| Chained PRs recommended | No — single-pr strategy selected |
| Size exception | Required (`size:exception`) |
| Decision needed before apply | No — delivery strategy already locked |

**Note**: The `size:exception` is pre-approved via `delivery_strategy: single-pr`. All 10 tasks ship in one PR on branch `nodo_clinica`.

---

## Execution notes for sdd-apply

- Run tasks in dependency order: T1 → T2 → T3 → T4 → (T5 ∥ T6) → (T7 ∥ T8 ∥ T9 ∥ T10)
- After T1: verify migration with `supabase db push` before proceeding
- After T3: smoke-test register endpoint manually (check console for verification URL in dev)
- After T4: use the console-logged URL to verify the full token flow before building UI
- T9 + T10 can be committed together as they have no internal dependency
- No new npm packages required: nodemailer is already in nodo-landing (confirm it's also in nodo-clinica's package.json; if not, add it)
