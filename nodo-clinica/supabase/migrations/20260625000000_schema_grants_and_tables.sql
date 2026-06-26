-- Migration 003: Schema grants, FK integrity, missing tables, storage bucket, theme_settings fix
-- Applies to the shared Supabase project (nodo_clinica schema).
-- Run AFTER migrations 001 and 002.

-- ============================================================
-- T1.2 — Schema-level grants (Data API access)
-- ============================================================

GRANT USAGE ON SCHEMA nodo_clinica TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA nodo_clinica
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ============================================================
-- T1.3 — FK integrity gaps from migration 002
-- Columns already exist; we only add the FK constraints.
-- ============================================================

-- doctor_presence.professional_id → nodo_clinica.professionals(id) ON DELETE CASCADE
ALTER TABLE nodo_clinica.doctor_presence
  ADD CONSTRAINT doctor_presence_professional_id_fkey
    FOREIGN KEY (professional_id)
    REFERENCES nodo_clinica.professionals(id)
    ON DELETE CASCADE;

-- chat_read_cursors.professional_id → nodo_clinica.professionals(id) ON DELETE CASCADE
ALTER TABLE nodo_clinica.chat_read_cursors
  ADD CONSTRAINT chat_read_cursors_professional_id_fkey
    FOREIGN KEY (professional_id)
    REFERENCES nodo_clinica.professionals(id)
    ON DELETE CASCADE;

-- interconsult_messages.from_professional_id → nodo_clinica.professionals(id)
ALTER TABLE nodo_clinica.interconsult_messages
  ADD CONSTRAINT interconsult_messages_from_professional_id_fkey
    FOREIGN KEY (from_professional_id)
    REFERENCES nodo_clinica.professionals(id);

-- interconsult_messages.to_professional_id → nodo_clinica.professionals(id)
ALTER TABLE nodo_clinica.interconsult_messages
  ADD CONSTRAINT interconsult_messages_to_professional_id_fkey
    FOREIGN KEY (to_professional_id)
    REFERENCES nodo_clinica.professionals(id);

-- ============================================================
-- T1.4 — Add org_id to presence and cursor tables
-- NOTE: These tables are assumed empty (new deployment).
-- If rows exist, backfill org_id before applying this migration:
--   UPDATE nodo_clinica.doctor_presence SET org_id = '<uuid>' WHERE org_id IS NULL;
--   UPDATE nodo_clinica.chat_read_cursors SET org_id = '<uuid>' WHERE org_id IS NULL;
-- ============================================================

ALTER TABLE nodo_clinica.doctor_presence
  ADD COLUMN org_id UUID NOT NULL REFERENCES shared.organizations(id);

ALTER TABLE nodo_clinica.chat_read_cursors
  ADD COLUMN org_id UUID NOT NULL REFERENCES shared.organizations(id);

-- ============================================================
-- T1.5 — Create missing tables
-- ============================================================

-- patient_health_profiles: chronic conditions, allergies, insurance
CREATE TABLE IF NOT EXISTS nodo_clinica.patient_health_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID        NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  blood_type          TEXT,
  allergies           TEXT[],
  chronic_conditions  TEXT[],
  insurance_provider  TEXT,
  insurance_number    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nodo_clinica.patient_health_profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER patient_health_profiles_updated_at
  BEFORE UPDATE ON nodo_clinica.patient_health_profiles
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- doctor_notifications: doctor-facing notification inbox
CREATE TABLE IF NOT EXISTS nodo_clinica.doctor_notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES shared.organizations(id),
  professional_id UUID        NOT NULL REFERENCES nodo_clinica.professionals(id),
  type            TEXT        NOT NULL,
  payload         JSONB,
  read            BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nodo_clinica.doctor_notifications ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER doctor_notifications_updated_at
  BEFORE UPDATE ON nodo_clinica.doctor_notifications
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- payment_credentials: isolated MercadoPago OAuth tokens, service_role-only access
-- No authenticated policies will be created — RLS blocks all non-service_role access.
CREATE TABLE IF NOT EXISTS nodo_clinica.payment_credentials (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL UNIQUE REFERENCES shared.organizations(id),
  access_token     TEXT        NOT NULL,
  refresh_token    TEXT,
  public_key       TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nodo_clinica.payment_credentials ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER payment_credentials_updated_at
  BEFORE UPDATE ON nodo_clinica.payment_credentials
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ============================================================
-- T1.6 — Storage bucket: patient-documents
-- Migration 001 already inserts this bucket; use ON CONFLICT to
-- ensure idempotency while making public = false authoritative.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
  VALUES ('patient-documents', 'patient-documents', false)
  ON CONFLICT (id) DO UPDATE SET public = false;

-- ============================================================
-- T1.7 — Fix theme_settings: drop NOT NULL, set DEFAULT NULL
-- (nodo-scaffold convention: theme_settings is always nullable)
-- ============================================================

ALTER TABLE nodo_clinica.office_settings
  ALTER COLUMN theme_settings DROP NOT NULL;

ALTER TABLE nodo_clinica.office_settings
  ALTER COLUMN theme_settings SET DEFAULT NULL;

-- ============================================================
-- T1.8 — FK indexes for query performance
-- Existing indexes from migration 002 already cover:
--   idx_clinica_appointments_doctor (org_id, doctor_id, status)
--   idx_clinica_appointments_patient (org_id, patient_id)
--   idx_clinica_records_patient (org_id, patient_id)
-- We add the remaining indexes called out in the spec.
-- ============================================================

-- appointments: standalone patient_id and org_id (supplement the composite indexes)
CREATE INDEX IF NOT EXISTS idx_clinica_appointments_patient_id
  ON nodo_clinica.appointments (patient_id);

CREATE INDEX IF NOT EXISTS idx_clinica_appointments_org_id
  ON nodo_clinica.appointments (org_id);

-- clinical_records: standalone patient_id and org_id
CREATE INDEX IF NOT EXISTS idx_clinica_records_patient_id
  ON nodo_clinica.clinical_records (patient_id);

CREATE INDEX IF NOT EXISTS idx_clinica_records_org_id
  ON nodo_clinica.clinical_records (org_id);

-- doctor_notifications: FK filter columns
CREATE INDEX IF NOT EXISTS idx_clinica_doctor_notifications_professional_id
  ON nodo_clinica.doctor_notifications (professional_id);

CREATE INDEX IF NOT EXISTS idx_clinica_doctor_notifications_org_id
  ON nodo_clinica.doctor_notifications (org_id);

-- patient_health_profiles: FK filter
CREATE INDEX IF NOT EXISTS idx_clinica_patient_health_profiles_patient_id
  ON nodo_clinica.patient_health_profiles (patient_id);

-- ============================================================
-- Verification hints (run manually after applying):
--   SELECT column_name, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'nodo_clinica'
--      AND table_name = 'office_settings'
--      AND column_name = 'theme_settings';
--
--   SELECT * FROM storage.buckets WHERE id = 'patient-documents';
--
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'nodo_clinica.interconsult_messages'::regclass;
-- ============================================================
