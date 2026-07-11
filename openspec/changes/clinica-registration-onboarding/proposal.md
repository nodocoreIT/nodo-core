# Proposal: Clinica Registration Onboarding

## Intent

nodo-clinica's registration is a single all-in-one form (email + password + specialty + plan upfront) with no email verification. This creates friction, prevents email validation, and diverges from the nodo-core ecosystem pattern (email-first registration, verification token, onboarding page). Replace it with a two-step flow: email-only registration with verification email, then role-specific onboarding pages.

## Scope

### In Scope
- Email-only registration forms for doctor and patient (replace current forms)
- `pending_clinic_registrations` table in `nodo_clinica` schema (token UUID, 24h TTL)
- Teal-branded (`#0D9488`) verification email via Zoho SMTP (Nodemailer)
- Token verification endpoint creating Supabase auth user via service role
- Doctor onboarding page: full name, specialty (SpecialtyCombobox), license number, plan
- Patient onboarding page: full name, address, DNI photos (front + back), obra social, plan
- DB migrations: `pending_clinic_registrations`, `subscription_plan` on professionals/patients, `obra_social` on patients
- Supabase Storage bucket for DNI photos
- Fix brand colors (replace blue-700/emerald-600 with `bg-brand` teal)

### Out of Scope
- Admin review workflow for doctor registrations (future)
- Payment integration for paid plans
- DNI photo OCR/validation
- Migrating existing nodo-landing email functions into a shared library
- Patient plan enforcement logic (Gratuito vs Pago data retention)

## Capabilities

### New Capabilities
- `clinic-email-registration`: Email-only step 1, pending registration storage, Zoho SMTP verification email
- `clinic-onboarding`: Role-specific onboarding pages (doctor/patient) with profile completion and plan selection
- `clinic-token-verification`: Token validation, Supabase user creation, redirect to onboarding

### Modified Capabilities
- None (current registration is replaced entirely, not modified)

## Approach

Mirror the nodo-landing custom token + Zoho SMTP pattern for ecosystem consistency:

1. **Step 1 (Registration)**: Email-only form POSTs to `/api/clinic/account/register`. Endpoint inserts `pending_clinic_registrations` row (UUID token, 24h expiry), sends teal-branded email via Zoho SMTP.
2. **Step 2 (Verification)**: User clicks email link hitting `/api/clinic/account/verify?token={token}&role={role}`. Validates token, creates Supabase auth user via `auth.admin.createUser()`, redirects to `/onboarding/{role}`.
3. **Step 3 (Onboarding)**: Role-specific page collects remaining profile data. Submit POSTs to `/api/clinic/account/onboarding`, inserting into `professionals` or `patients` + `org_members`.

**Why custom tokens over Supabase OTP**: Full control over email HTML/branding (teal CTA button), consistent pattern across nodo-core ecosystem, battle-tested in nodo-landing.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `nodo-clinica/src/app/registro/medico/page.tsx` | Modified | Replace with email-only form |
| `nodo-clinica/src/app/registro/paciente/page.tsx` | Modified | Replace with email-only form |
| `nodo-clinica/src/app/api/clinic/account/register/route.ts` | Modified | Store pending row + send email instead of direct signUp |
| `nodo-clinica/src/app/onboarding/medico/page.tsx` | New | Doctor onboarding form |
| `nodo-clinica/src/app/onboarding/paciente/page.tsx` | New | Patient onboarding form |
| `nodo-clinica/src/app/api/clinic/account/verify/route.ts` | New | Token verification + user creation |
| `nodo-clinica/src/app/api/clinic/account/onboarding/route.ts` | New | Complete onboarding profile |
| `nodo-clinica/src/lib/mail.ts` | New | Nodemailer + Zoho SMTP, teal-branded templates |
| `nodo-clinica/src/lib/clinic/client-api.ts` | Modified | Update register(), add completeOnboarding() |
| DB: `nodo_clinica.pending_clinic_registrations` | New | Token, email, role, expires_at, verified_at |
| DB: `nodo_clinica.professionals` | Modified | Add `subscription_plan` column |
| DB: `nodo_clinica.patients` | Modified | Add `subscription_plan`, `obra_social` columns |
| Supabase Storage | New | Bucket for DNI document photos |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Zoho SMTP env vars not configured in nodo-clinica deployment | Med | Document required vars; fallback: Supabase OTP as plan B |
| DNI photo storage bucket permissions misconfigured | Low | RLS policies scoped to authenticated user's own uploads |
| Token expiry race condition (user clicks after 24h) | Low | Clear error page with re-registration link |
| Existing registered users affected by flow change | Low | Old auth records remain valid; change only affects new registrations |

## Rollback Plan

Revert the migration (drop `pending_clinic_registrations`, remove new columns) and restore original registration page components from git. Existing Supabase auth users are unaffected since the change only modifies the registration path.

## Dependencies

- `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`, `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD` env vars in nodo-clinica
- `SUPABASE_SERVICE_ROLE_KEY` (already available in nodo-clinica)
- Supabase Storage enabled on the project

## Success Criteria

- [ ] New user can register with email only, receive verification email, and complete onboarding
- [ ] Doctor onboarding collects name, specialty, license, plan and creates `professionals` row
- [ ] Patient onboarding collects name, address, DNI photos, obra social, plan and creates `patients` row
- [ ] Verification email renders with teal `#0D9488` CTA button and "Nodo Clinica" branding
- [ ] Registration pages use `bg-brand` teal instead of blue-700/emerald-600
- [ ] Expired/invalid tokens show clear error with re-registration option
