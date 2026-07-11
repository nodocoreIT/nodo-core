# Clinic Token Verification Specification

## Purpose

Handles step 2 of the registration flow: validates the UUID token from the verification email, creates a Supabase auth user via service role, marks the token verified, establishes a session, and redirects the user to the appropriate onboarding page.

## Requirements

### Requirement: Token Validation

The system MUST validate the token before any user creation occurs.

A token is valid if and only if:
1. A row exists in `pending_clinic_registrations` with the matching token UUID
2. `expires_at` is in the future
3. `verified_at` is null

#### Scenario: Valid token

- GIVEN a `pending_clinic_registrations` row with a matching token, future `expires_at`, and null `verified_at`
- WHEN `GET /api/clinic/account/verify?token={token}&role={role}` is called
- THEN the system proceeds to user creation

#### Scenario: Expired token

- GIVEN a row with `expires_at` in the past
- WHEN the verify endpoint is called
- THEN the system MUST return an error page indicating the token expired
- AND the page MUST provide a link or CTA to re-register

#### Scenario: Already-verified token

- GIVEN a row where `verified_at` is not null
- WHEN the verify endpoint is called
- THEN the system MUST return an error indicating the link was already used
- AND MUST NOT create a duplicate auth user

#### Scenario: Token not found

- GIVEN no row matches the provided token UUID
- WHEN the verify endpoint is called
- THEN the system MUST return a 404-equivalent error page

### Requirement: Supabase Auth User Creation

After successful token validation, the system MUST create a Supabase auth user using the service role client (`auth.admin.createUser()`).

#### Scenario: Successful user creation

- GIVEN a valid token for `user@example.com` with role `doctor`
- WHEN the system calls `auth.admin.createUser()` with the email
- THEN a Supabase auth user is created
- AND `pending_clinic_registrations.verified_at` is set to the current timestamp

#### Scenario: Email already exists in auth

- GIVEN a Supabase auth user already exists for that email
- WHEN `auth.admin.createUser()` is called
- THEN the system MUST handle the conflict gracefully (return error, do not crash)
- AND `verified_at` MUST NOT be set

### Requirement: Session and Redirect

After user creation, the system MUST establish an authenticated session and redirect to the role-specific onboarding page.

#### Scenario: Doctor verification redirect

- GIVEN role is `doctor` and user creation succeeds
- WHEN the redirect is issued
- THEN the user is sent to `/onboarding/medico` with an active session

#### Scenario: Patient verification redirect

- GIVEN role is `patient` and user creation succeeds
- WHEN the redirect is issued
- THEN the user is sent to `/onboarding/paciente` with an active session
