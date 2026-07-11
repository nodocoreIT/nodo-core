# Clinic Email Registration Specification

## Purpose

Handles step 1 of the two-step registration flow: accepts an email address and role, persists a pending registration token, and sends a teal-branded verification email via Zoho SMTP.

## Requirements

### Requirement: Email-Only Registration Form

The system MUST provide dedicated registration pages for doctors (`/registro/medico`) and patients (`/registro/paciente`) that collect only an email address. No password, specialty, or plan fields SHALL appear on these pages.

#### Scenario: Doctor submits valid email

- GIVEN a visitor is on `/registro/medico`
- WHEN they submit a valid, unused email address
- THEN the system creates a row in `nodo_clinica.pending_clinic_registrations` with role `doctor`, a UUID token, and `expires_at` set to 24 hours from now
- AND returns a success confirmation (no redirect to auth)

#### Scenario: Patient submits valid email

- GIVEN a visitor is on `/registro/paciente`
- WHEN they submit a valid, unused email address
- THEN the system creates a row with role `patient` and the same token/expiry rules
- AND returns a success confirmation

### Requirement: Verification Email Delivery

The system MUST send a verification email via Zoho SMTP (Nodemailer) after a pending registration row is created.

The email MUST include:
- Subject: "Confirmá tu registro en Nodo Clínica"
- A CTA button with background color `#0D9488` (teal) linking to `/api/clinic/account/verify?token={token}&role={role}`
- "Nodo Clínica" branding visible in the body

#### Scenario: Verification email sent successfully

- GIVEN a registration row was created
- WHEN the SMTP send completes
- THEN the user's inbox receives an email matching the subject and teal CTA requirements

#### Scenario: SMTP failure

- GIVEN SMTP credentials are misconfigured or the provider is unreachable
- WHEN the registration endpoint attempts to send the email
- THEN the endpoint MUST return an error response (5xx)
- AND the pending registration row MUST be rolled back or deleted

### Requirement: Duplicate Email Handling

The system MUST reject registration attempts for an email that already has a non-expired, unverified pending registration.

#### Scenario: Duplicate within 24h window

- GIVEN a pending row for `user@example.com` with role `doctor` exists and `expires_at` is in the future and `verified_at` is null
- WHEN the same email is submitted again
- THEN the endpoint returns a 409 or equivalent error with a human-readable message
- AND no new row is inserted

#### Scenario: Duplicate after token expiry

- GIVEN a pending row for `user@example.com` exists with `expires_at` in the past
- WHEN the same email is submitted
- THEN the system SHOULD allow a new registration and MAY replace or soft-delete the expired row

### Requirement: Brand Color Tokens

All registration pages MUST use `bg-brand` teal tokens (`#0D9488`). No blue-700 or emerald-600 Tailwind classes SHALL appear on registration UI.

#### Scenario: Page renders with correct brand color

- GIVEN the registration page is rendered
- WHEN the primary CTA button is inspected
- THEN its background resolves to `#0D9488`
