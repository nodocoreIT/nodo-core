# Design: Clinica Registration Onboarding

## Technical Approach

Split the monolithic registration form into a 3-step flow (email -> verify -> onboard) using the same custom-token + Zoho SMTP pattern established in nodo-landing. All DB operations use the existing `createServiceClient()` (service role). New pages follow the existing `"use client"` + `clinicApi.*` pattern. No shared libraries created; `nodo-clinica/src/lib/mail.ts` is a standalone module mirroring nodo-landing's transport setup.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Token storage | New `nodo_clinica.pending_clinic_registrations` table | Reuse nodo-landing's `nodo_core.pending_registrations` | Clinica runs on its own Supabase project/schema; cross-schema dependency adds coupling. Clinic tokens are simpler (no admin review, no unit_code). |
| User creation | `auth.admin.createUser({ email_confirm: true })` at verify time | `auth.signUp()` at registration time | No password needed at step 1. Admin API creates a confirmed user without email flow. Password set via `updateUser` during onboarding or via magic link. |
| Session after verify | `auth.admin.generateLink({ type: 'magiclink' })` -> redirect with token_hash | Manual `setSession` with generated tokens | `generateLink` is the supported admin API for creating sessions for service-created users. The returned `hashed_token` feeds into `/auth/v1/verify` which sets cookies. |
| Onboarding auth guard | Client-side redirect via `useEffect` + `getSession()` | Server Component with `redirect()` | Matches existing clinica pattern (all pages are `"use client"`). Keep consistent. |
| DNI upload | Supabase Storage bucket `clinic-registration-docs` with RLS | Base64 in DB column | Files can be large; Storage is purpose-built. RLS scopes to `auth.uid()`. |
| Onboarding API split | Two routes: `/onboarding/medico` and `/onboarding/paciente` | Single `/onboarding` with role switch | Patient needs `FormData` (file uploads); doctor is JSON. Separate routes avoid content-type branching. |
| Email module | Standalone `nodo-clinica/src/lib/mail.ts` | Import from nodo-landing | nodo-clinica is a separate Next.js app with its own deployment. Cross-app imports are not possible. Same env vars, same Nodemailer pattern. |

## Data Flow

```
Registration:
  Browser ──POST {email,role}──> /api/clinic/account/register
    │  insert pending_clinic_registrations (token UUID, 24h TTL)
    │  send teal verification email via Zoho SMTP
    └──> 200 { ok: true }
    Browser shows "Revisa tu correo"

Verification:
  Email link ──GET──> /api/clinic/account/verify?token=X&role=medico
    │  validate token (not expired, not used)
    │  auth.admin.createUser({ email, email_confirm: true })
    │  mark token verified_at = now()
    │  auth.admin.generateLink({ type: 'magiclink', email })
    │  redirect -> /auth/v1/verify?token_hash=...&redirect_to=/onboarding/{role}
    └──> Browser lands on /onboarding/{role} with active session

Onboarding (doctor):
  Browser ──POST JSON──> /api/clinic/account/onboarding/medico
    │  requireAuth (existing auth-guard)
    │  insert professionals + org_members (service client)
    └──> redirect /medico/dashboard

Onboarding (patient):
  Browser ──POST FormData──> /api/clinic/account/onboarding/paciente
    │  requireAuth
    │  upload DNI files to Storage bucket
    │  insert patients (service client)
    └──> redirect /paciente/dashboard
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `nodo-clinica/supabase/migrations/00001_pending_clinic_registrations.sql` | Create | `pending_clinic_registrations` table, ALTER professionals + patients columns, Storage bucket + RLS |
| `nodo-clinica/src/lib/mail.ts` | Create | Nodemailer + Zoho SMTP transport, `sendClinicVerificationEmail()` with teal HTML template |
| `nodo-clinica/src/app/api/clinic/account/register/route.ts` | Modify | Replace signUp logic with: insert pending row + send verification email. Body becomes `{ email, role }` only. |
| `nodo-clinica/src/app/api/clinic/account/verify/route.ts` | Create | GET handler: validate token, create user via admin API, generate magic link, redirect to onboarding |
| `nodo-clinica/src/app/api/clinic/account/onboarding/medico/route.ts` | Create | POST: auth guard, insert professionals + org_members |
| `nodo-clinica/src/app/api/clinic/account/onboarding/paciente/route.ts` | Create | POST: auth guard, upload DNI to Storage, insert patients |
| `nodo-clinica/src/app/registro/medico/page.tsx` | Modify | Replace with email-only form, teal branding (`bg-brand`), success "check email" state |
| `nodo-clinica/src/app/registro/paciente/page.tsx` | Modify | Replace with email-only form, teal branding, success state |
| `nodo-clinica/src/app/onboarding/medico/page.tsx` | Create | Auth-guarded form: fullName, SpecialtyCombobox, licenseNumber, plan cards |
| `nodo-clinica/src/app/onboarding/paciente/page.tsx` | Create | Auth-guarded form: fullName, address, DNI photo slots, obra social, plan cards |
| `nodo-clinica/src/lib/clinic/client-api.ts` | Modify | Simplify `register()` to `{ email, role }`, add `completeOnboardingMedico()` + `completeOnboardingPaciente()` |

## Interfaces / Contracts

```sql
-- pending_clinic_registrations
CREATE TABLE nodo_clinica.pending_clinic_registrations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  role       text NOT NULL CHECK (role IN ('medico', 'paciente')),
  token      uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON nodo_clinica.pending_clinic_registrations (email, role)
  WHERE verified_at IS NULL;
```

```typescript
// client-api.ts additions
register(payload: { email: string; role: 'medico' | 'paciente' }): Promise<{ ok: boolean }>
completeOnboardingMedico(data: {
  fullName: string; specialty: string; licenseNumber: string; plan: string;
}): Promise<{ ok: boolean }>
completeOnboardingPaciente(formData: FormData): Promise<{ ok: boolean }>
// FormData keys: fullName, address, obraSocial, plan, dniFront (File), dniBack (File)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `sendClinicVerificationEmail` builds correct HTML, token URL | Mock nodemailer transport, assert HTML contains teal CTA and correct link |
| Integration | Register -> pending row created, verify -> user exists, onboarding -> profile row | Supabase test project or mocked service client |
| E2E | Full flow: register email, click link, complete onboarding | Manual smoke test (Zoho SMTP in dev) |

## Migration / Rollout

Single migration file covers all schema changes. Run via Supabase CLI or SQL Editor before deploying the app update. Storage bucket creation included in migration. Rollback: drop `pending_clinic_registrations`, remove added columns (non-destructive since no existing data uses them), delete storage bucket.

## Open Questions

- [ ] Password strategy: should onboarding set a password, or rely on magic links for future logins? (Design assumes magic-link-only for now; password can be added to onboarding form if needed.)
- [ ] Should `CLINIC_ORG_ID` still be hardcoded or derived from a lookup during onboarding?
