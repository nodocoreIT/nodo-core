-- Migration: add height_cm and weight_kg to patient_health_profiles
-- Creates the table first (IF NOT EXISTS) so this migration is safe to run
-- on environments where the table was created manually via the SQL editor.

CREATE TABLE IF NOT EXISTS nodo_clinica.patient_health_profiles (
  patient_id          uuid PRIMARY KEY REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  blood_type          text,
  allergies           text[],
  chronic_conditions  text[],
  insurance_provider  text,
  insurance_number    text,
  height_cm           numeric(5,1),
  weight_kg           numeric(5,1),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- If the table already exists, add the columns idempotently
ALTER TABLE nodo_clinica.patient_health_profiles
  ADD COLUMN IF NOT EXISTS height_cm              numeric(5,1),
  ADD COLUMN IF NOT EXISTS weight_kg              numeric(5,1),
  ADD COLUMN IF NOT EXISTS medications            text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name  text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

-- Ensure patient_id has a unique constraint so upsert ON CONFLICT works.
-- (Tables created manually via SQL editor may be missing this.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'nodo_clinica.patient_health_profiles'::regclass
      AND contype IN ('p', 'u')
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'nodo_clinica.patient_health_profiles'::regclass
           AND attname = 'patient_id')
      ]
  ) THEN
    ALTER TABLE nodo_clinica.patient_health_profiles
      ADD CONSTRAINT patient_health_profiles_patient_id_key UNIQUE (patient_id);
  END IF;
END;
$$;

-- RLS: patients can read/write their own row
ALTER TABLE nodo_clinica.patient_health_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'nodo_clinica'
      AND tablename  = 'patient_health_profiles'
      AND policyname = 'health_profile_patient_self'
  ) THEN
    CREATE POLICY "health_profile_patient_self"
      ON nodo_clinica.patient_health_profiles
      FOR ALL
      USING (
        patient_id IN (
          SELECT id FROM nodo_clinica.patients WHERE profile_id = auth.uid()
        )
      );
  END IF;
END;
$$;
