-- ============================================================
-- 003_bridge_to_ecosystem_schema.sql
-- Bridge migration: transforms the initial nodo_clinica schema
-- to the target state defined in 002_nodo_clinica_ecosystem_schema.sql.
-- Safe to run once against a DB that has the initial 5 tables
-- with seed data. Idempotent where possible.
-- ============================================================

-- ============================================================
-- SECTION 0 — Resolve the clinica org_id for backfill
-- ============================================================
DO $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id
  FROM shared.organizations
  WHERE product = 'clinica'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization with product = ''clinica'' found in shared.organizations. Cannot proceed.';
  END IF;
END $$;

-- Store it in a temp table so subsequent statements can reference it
-- without repeating the subquery every time.
CREATE TEMP TABLE _clinica_org AS
  SELECT id AS org_id
  FROM shared.organizations
  WHERE product = 'clinica'
  LIMIT 1;


-- ============================================================
-- SECTION 1 — professionals
-- Current:  id, user_id, first_name, last_name, specialty,
--           license_number, created_at, updated_at
-- Target:   + org_id, full_name, email, subscription_status,
--             subscription_plan, profile_photo_url, bio,
--             signature_text, signature_image_url,
--             google_calendar_id
--           UNIQUE(org_id, email)
--           first_name / last_name: KEPT for backward compat
-- ============================================================

-- 1a. Add nullable columns first
ALTER TABLE nodo_clinica.professionals
  ADD COLUMN IF NOT EXISTS org_id UUID,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'expired')),
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS signature_text TEXT,
  ADD COLUMN IF NOT EXISTS signature_image_url TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;

-- Ensure updated_at has NOT NULL default (may already be set)
ALTER TABLE nodo_clinica.professionals
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- 1b. Backfill org_id from the temp table
UPDATE nodo_clinica.professionals
SET org_id = (SELECT org_id FROM _clinica_org)
WHERE org_id IS NULL;

-- 1c. Backfill full_name from existing first_name + last_name
UPDATE nodo_clinica.professionals
SET full_name = TRIM(first_name || ' ' || last_name)
WHERE full_name IS NULL;

-- 1d. Backfill email: use a placeholder so NOT NULL can be added.
--     Real emails must be updated manually after migration.
UPDATE nodo_clinica.professionals
SET email = 'pending-' || id::text || '@placeholder.nodo'
WHERE email IS NULL;

-- 1e. Now add NOT NULL constraints
ALTER TABLE nodo_clinica.professionals
  ALTER COLUMN org_id SET NOT NULL,
  ALTER COLUMN full_name SET NOT NULL,
  ALTER COLUMN email SET NOT NULL;

-- 1f. FK to shared.organizations (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'professionals_org_id_fkey'
      AND conrelid = 'nodo_clinica.professionals'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.professionals
      ADD CONSTRAINT professionals_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES shared.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 1g. FK user_id -> auth.users (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'professionals_user_id_fkey'
      AND conrelid = 'nodo_clinica.professionals'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.professionals
      ADD CONSTRAINT professionals_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 1h. Unique constraint on (org_id, email) — skip if duplicate data exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'professionals_org_id_email_key'
      AND conrelid = 'nodo_clinica.professionals'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.professionals
      ADD CONSTRAINT professionals_org_id_email_key UNIQUE (org_id, email);
  END IF;
END $$;

-- 1i. moddatetime trigger
CREATE OR REPLACE TRIGGER trg_professionals_updated_at
  BEFORE UPDATE ON nodo_clinica.professionals
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);


-- ============================================================
-- SECTION 2 — patients
-- Current:  id, user_id, health_insurance_id, affiliate_number,
--           first_name, last_name, dni, email, phone,
--           date_of_birth, created_at, updated_at
-- Target:   + org_id, profile_id, full_name, profile_photo_url,
--             medical_record_number
--           email NOT NULL, UNIQUE(org_id, email)
--           first_name/last_name/dni/health_insurance_id/
--           affiliate_number/user_id/updated_at: KEPT
-- ============================================================

ALTER TABLE nodo_clinica.patients
  ADD COLUMN IF NOT EXISTS org_id UUID,
  ADD COLUMN IF NOT EXISTS profile_id UUID,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS medical_record_number TEXT;

ALTER TABLE nodo_clinica.patients
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Backfill org_id
UPDATE nodo_clinica.patients
SET org_id = (SELECT org_id FROM _clinica_org)
WHERE org_id IS NULL;

-- Backfill full_name
UPDATE nodo_clinica.patients
SET full_name = TRIM(first_name || ' ' || last_name)
WHERE full_name IS NULL;

-- Backfill email placeholder where NULL
UPDATE nodo_clinica.patients
SET email = 'pending-' || id::text || '@placeholder.nodo'
WHERE email IS NULL;

-- NOT NULL
ALTER TABLE nodo_clinica.patients
  ALTER COLUMN org_id SET NOT NULL,
  ALTER COLUMN full_name SET NOT NULL,
  ALTER COLUMN email SET NOT NULL;

-- FK org_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_org_id_fkey'
      AND conrelid = 'nodo_clinica.patients'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.patients
      ADD CONSTRAINT patients_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES shared.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- FK profile_id -> auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_profile_id_fkey'
      AND conrelid = 'nodo_clinica.patients'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.patients
      ADD CONSTRAINT patients_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Unique (org_id, email)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_org_id_email_key'
      AND conrelid = 'nodo_clinica.patients'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.patients
      ADD CONSTRAINT patients_org_id_email_key UNIQUE (org_id, email);
  END IF;
END $$;


-- ============================================================
-- SECTION 3 — appointments
-- Current:  id, patient_id, professional_id, appointment_date,
--           status, notes, created_at, updated_at
-- Target:   + org_id, doctor_id (alias for professional_id),
--             scheduled_at (alias for appointment_date),
--             queue_position, jitsi_room_id, access_token,
--             token_expires_at, payment_status,
--             payment_confirmed_at, payment_provider,
--             intake_reason, reminder_sent_at
--           status CHECK updated
--           patient_id FK -> nodo_clinica.patients
--           professional_id / appointment_date / notes: KEPT
-- ============================================================

ALTER TABLE nodo_clinica.appointments
  ADD COLUMN IF NOT EXISTS org_id UUID,
  ADD COLUMN IF NOT EXISTS doctor_id UUID,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queue_position INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jitsi_room_id TEXT,
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_status TEXT
    CHECK (payment_status IN ('pending', 'confirmed', 'waived')),
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS intake_reason TEXT,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

ALTER TABLE nodo_clinica.appointments
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- Backfill org_id
UPDATE nodo_clinica.appointments
SET org_id = (SELECT org_id FROM _clinica_org)
WHERE org_id IS NULL;

-- Backfill doctor_id from professional_id
UPDATE nodo_clinica.appointments
SET doctor_id = professional_id
WHERE doctor_id IS NULL AND professional_id IS NOT NULL;

-- Backfill scheduled_at from appointment_date
UPDATE nodo_clinica.appointments
SET scheduled_at = appointment_date
WHERE scheduled_at IS NULL AND appointment_date IS NOT NULL;

-- Backfill required columns for target NOT NULLs
UPDATE nodo_clinica.appointments
SET jitsi_room_id = 'room-' || id::text
WHERE jitsi_room_id IS NULL;

UPDATE nodo_clinica.appointments
SET access_token = encode(gen_random_bytes(32), 'hex')
WHERE access_token IS NULL;

UPDATE nodo_clinica.appointments
SET token_expires_at = NOW() + INTERVAL '24 hours'
WHERE token_expires_at IS NULL;

-- NOT NULL after backfill
ALTER TABLE nodo_clinica.appointments
  ALTER COLUMN org_id SET NOT NULL,
  ALTER COLUMN doctor_id SET NOT NULL,
  ALTER COLUMN scheduled_at SET NOT NULL,
  ALTER COLUMN jitsi_room_id SET NOT NULL,
  ALTER COLUMN access_token SET NOT NULL,
  ALTER COLUMN token_expires_at SET NOT NULL;

-- FK org_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_org_id_fkey'
      AND conrelid = 'nodo_clinica.appointments'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.appointments
      ADD CONSTRAINT appointments_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES shared.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- FK doctor_id -> professionals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_doctor_id_fkey'
      AND conrelid = 'nodo_clinica.appointments'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.appointments
      ADD CONSTRAINT appointments_doctor_id_fkey
      FOREIGN KEY (doctor_id) REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE;
  END IF;
END $$;

-- FK patient_id -> nodo_clinica.patients (replaces old bare uuid)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_patient_id_fkey'
      AND conrelid = 'nodo_clinica.appointments'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.appointments
      ADD CONSTRAINT appointments_patient_id_fkey
      FOREIGN KEY (patient_id) REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE;
  END IF;
END $$;

-- UNIQUE access_token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_access_token_key'
      AND conrelid = 'nodo_clinica.appointments'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.appointments
      ADD CONSTRAINT appointments_access_token_key UNIQUE (access_token);
  END IF;
END $$;

-- moddatetime trigger
CREATE OR REPLACE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON nodo_clinica.appointments
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);


-- ============================================================
-- SECTION 4 — health_insurances
-- Not in target schema — keep as-is for backward compatibility.
-- No action needed.
-- ============================================================


-- ============================================================
-- SECTION 5 — medical_records
-- Not in target schema — keep as-is for backward compatibility.
-- (Target has clinical_records instead; created below.)
-- No action needed on existing table.
-- ============================================================


-- ============================================================
-- SECTION 6 — NEW TABLES from target not in current schema
-- ============================================================

-- 6a. office_settings
CREATE TABLE IF NOT EXISTS nodo_clinica.office_settings (
  professional_id UUID PRIMARY KEY REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  availability JSONB NOT NULL DEFAULT '{"slotDurationMinutes":30,"days":[]}'::jsonb,
  payment JSONB NOT NULL DEFAULT '{}'::jsonb,
  reminder_settings JSONB NOT NULL DEFAULT '{"enabled":false,"minutesBefore":1440}'::jsonb,
  theme_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_office_settings_updated_at
  BEFORE UPDATE ON nodo_clinica.office_settings
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- 6b. clinical_records
CREATE TABLE IF NOT EXISTS nodo_clinica.clinical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES nodo_clinica.appointments(id) ON DELETE SET NULL,
  record_type TEXT NOT NULL DEFAULT 'consultation',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6c. clinical_notes
CREATE TABLE IF NOT EXISTS nodo_clinica.clinical_notes (
  appointment_id UUID PRIMARY KEY REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_clinical_notes_updated_at
  BEFORE UPDATE ON nodo_clinica.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- 6d. transcriptions
CREATE TABLE IF NOT EXISTS nodo_clinica.transcriptions (
  appointment_id UUID PRIMARY KEY REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_transcriptions_updated_at
  BEFORE UPDATE ON nodo_clinica.transcriptions
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- 6e. prescriptions
CREATE TABLE IF NOT EXISTS nodo_clinica.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6f. study_orders
CREATE TABLE IF NOT EXISTS nodo_clinica.study_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  studies JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6g. soap_summaries
CREATE TABLE IF NOT EXISTS nodo_clinica.soap_summaries (
  appointment_id UUID PRIMARY KEY REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  subjective TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  analysis TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6h. patient_documents
CREATE TABLE IF NOT EXISTS nodo_clinica.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES nodo_clinica.appointments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_doctor BOOLEAN NOT NULL DEFAULT FALSE
);

-- 6i. doctor_tasks
CREATE TABLE IF NOT EXISTS nodo_clinica.doctor_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES shared.organizations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6j. interconsult_messages
CREATE TABLE IF NOT EXISTS nodo_clinica.interconsult_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES shared.organizations(id) ON DELETE SET NULL,
  from_professional_id UUID NOT NULL,
  from_professional_name TEXT NOT NULL,
  to_professional_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6k. doctor_presence
CREATE TABLE IF NOT EXISTS nodo_clinica.doctor_presence (
  professional_id UUID PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6l. chat_read_cursors
CREATE TABLE IF NOT EXISTS nodo_clinica.chat_read_cursors (
  professional_id UUID PRIMARY KEY,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- SECTION 7 — Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_clinica_appointments_doctor
  ON nodo_clinica.appointments (org_id, doctor_id, status);

CREATE INDEX IF NOT EXISTS idx_clinica_appointments_patient
  ON nodo_clinica.appointments (org_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_clinica_records_patient
  ON nodo_clinica.clinical_records (org_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_clinica_tasks_doctor_due
  ON nodo_clinica.doctor_tasks (org_id, doctor_id, due_date);


-- ============================================================
-- SECTION 8 — Enable RLS on all tables
-- ============================================================

ALTER TABLE nodo_clinica.professionals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.office_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.patients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.appointments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.clinical_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.clinical_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.doctor_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodo_clinica.interconsult_messages ENABLE ROW LEVEL SECURITY;

-- Tables below are not in target's RLS block but exist — add when policies are defined:
-- nodo_clinica.prescriptions, study_orders, soap_summaries,
-- patient_documents, transcriptions, doctor_presence, chat_read_cursors


-- ============================================================
-- SECTION 9 — Schema comment
-- ============================================================

COMMENT ON SCHEMA nodo_clinica IS
  'Dominio Nodo Salud — PHI clínico, multi-tenant vía shared.organizations';


-- ============================================================
-- CLEANUP
-- ============================================================

DROP TABLE IF EXISTS _clinica_org;
