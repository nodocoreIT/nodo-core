# Spec Index: clinica-registration-onboarding

## Overview

Replaces the current all-in-one registration form with a three-step flow:
1. Email-only registration + verification email
2. Token verification + Supabase auth user creation
3. Role-specific onboarding (doctor or patient)

## Domain Specs

| Domain | Path | Type | Requirements | Scenarios |
|--------|------|------|-------------|-----------|
| `clinic-email-registration` | `specs/clinic-email-registration/spec.md` | New | 4 | 7 |
| `clinic-token-verification` | `specs/clinic-token-verification/spec.md` | New | 3 | 7 |
| `clinic-onboarding` | `specs/clinic-onboarding/spec.md` | New | 4 | 8 |

## Coverage Summary

- Happy paths: covered (all primary flows have success scenarios)
- Edge cases: covered (expired token, duplicate email, missing files, upload failure, wrong user access)
- Error states: covered (SMTP failure, auth conflict, partial record prevention, RLS denial)

## Spec Assumptions

1. "Atomic intent" for patient onboarding (no partial records on upload failure) is a behavioral requirement, not an implementation mandate — the HOW is left to design.
2. The `role` query param on the verify endpoint is trusted server-side only when it matches the `pending_clinic_registrations.role` value — spec does not specify mismatch behavior (assumed: reject; design should confirm).
3. Plan values (Trial/Básico/Profesional for doctors; Gratuito/Pago for patients) are treated as string literals in the spec — enumeration/validation rules are left to design.
