# Clinic Onboarding Specification

## Purpose

Handles step 3 of the registration flow: role-specific onboarding forms that collect profile data, handle file uploads (patients), and create the corresponding DB records in `nodo_clinica.professionals` or `nodo_clinica.patients`.

## Requirements

### Requirement: Doctor Onboarding Form

The system MUST provide `/onboarding/medico` collecting: full name, specialty (via SpecialtyCombobox), license number, and subscription plan (Trial / Básico / Profesional).

#### Scenario: Doctor submits valid onboarding data

- GIVEN an authenticated user (role `doctor`) on `/onboarding/medico`
- WHEN they submit full name, specialty, license number, and a plan
- THEN `POST /api/clinic/account/onboarding/medico` inserts a row in `nodo_clinica.professionals` with `subscription_plan` set
- AND the user is redirected to the doctor dashboard

#### Scenario: Doctor submits without required fields

- GIVEN the doctor onboarding form
- WHEN any required field (name, specialty, license, plan) is missing
- THEN the form MUST show inline validation errors
- AND MUST NOT submit to the API

### Requirement: Patient Onboarding Form

The system MUST provide `/onboarding/paciente` collecting: full name, address, DNI front photo, DNI back photo, obra social, and plan (Gratuito / Pago).

#### Scenario: Patient submits valid onboarding data with DNI photos

- GIVEN an authenticated user (role `patient`) on `/onboarding/paciente`
- WHEN they submit all required fields including both DNI photo files
- THEN the system uploads the files to Supabase Storage bucket `clinic-registration-docs/{userId}/`
- AND inserts a row in `nodo_clinica.patients` with `subscription_plan`, `obra_social`, `address`, `dni_front_url`, `dni_back_url`
- AND the user is redirected to the patient dashboard

#### Scenario: Patient submits without DNI photos

- GIVEN the patient onboarding form
- WHEN the form is submitted with one or both DNI photos missing
- THEN the form MUST show inline validation errors
- AND MUST NOT submit to the API

#### Scenario: File upload failure

- GIVEN a patient submits valid form data
- WHEN the Supabase Storage upload fails for either DNI photo
- THEN the API MUST return an error response
- AND the `patients` row MUST NOT be inserted (atomic intent: no partial records)

### Requirement: DB Migrations

The system MUST include migrations that create or alter the following before any onboarding can succeed:

| Object | Operation | Details |
|--------|-----------|---------|
| `nodo_clinica.pending_clinic_registrations` | CREATE | `id UUID PK`, `email TEXT`, `role TEXT`, `token UUID UNIQUE`, `expires_at TIMESTAMPTZ`, `verified_at TIMESTAMPTZ nullable` |
| `nodo_clinica.professionals` | ALTER | ADD `subscription_plan TEXT NOT NULL DEFAULT 'trial'` |
| `nodo_clinica.patients` | ALTER | ADD `subscription_plan TEXT NOT NULL DEFAULT 'gratuito'`, `obra_social TEXT`, `address TEXT`, `dni_front_url TEXT`, `dni_back_url TEXT` |

#### Scenario: Migration runs on clean schema

- GIVEN the migration has not been applied
- WHEN the migration is executed
- THEN all listed objects exist with the specified columns and types
- AND existing rows in `professionals` and `patients` receive the default column values

### Requirement: Storage Bucket Access Control

The Supabase Storage bucket `clinic-registration-docs` MUST enforce RLS such that:
- An authenticated user can read only their own files (path prefixed with their `userId`)
- Only the service role can write files

#### Scenario: Owner reads own DNI photo

- GIVEN a patient with `userId = abc` and a file at `clinic-registration-docs/abc/front.jpg`
- WHEN that user requests the file URL
- THEN access is granted

#### Scenario: Other user reads another's DNI photo

- GIVEN a different authenticated user `xyz`
- WHEN they attempt to access `clinic-registration-docs/abc/front.jpg`
- THEN access is denied (403 or equivalent)
