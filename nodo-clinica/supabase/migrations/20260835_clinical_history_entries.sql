-- Migration: clinical_history_entries (append-only medical evolution log)
--
-- Part of the patient's longitudinal clinical history (historia clínica).
-- Append-only by design: entries are dated and authored, never edited, so the
-- record keeps medical-legal traceability. This coexists with, and does NOT
-- replace, the per-consultation clinical_notes (working notes of a single
-- visit) and soap_summaries — they are different things and live side by side.
--
-- Safe to run on environments where the schema was bootstrapped via the SQL
-- editor: every statement is idempotent.

CREATE TABLE IF NOT EXISTS nodo_clinica.clinical_history_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES nodo_clinica.patients(id) ON DELETE CASCADE,
  doctor_id      uuid NOT NULL REFERENCES nodo_clinica.professionals(id),
  org_id         uuid,
  -- Optional link to the consultation the entry was written during. Nullable:
  -- an evolution note may be added outside of any single appointment.
  appointment_id uuid REFERENCES nodo_clinica.appointments(id) ON DELETE SET NULL,
  body           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinical_history_entries_patient_idx
  ON nodo_clinica.clinical_history_entries (patient_id, created_at DESC);

-- Append-only enforcement at the database level: block UPDATE for everyone,
-- including the service role (which bypasses RLS). Entries can only be
-- inserted, never rewritten. DELETE is intentionally NOT blocked so that
-- cascading a patient deletion still works; the application exposes no delete
-- endpoint for individual entries.
CREATE OR REPLACE FUNCTION nodo_clinica.clinical_history_entries_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'clinical_history_entries is append-only: UPDATE is not allowed';
END;
$$;

DROP TRIGGER IF EXISTS clinical_history_entries_no_update
  ON nodo_clinica.clinical_history_entries;
CREATE TRIGGER clinical_history_entries_no_update
  BEFORE UPDATE ON nodo_clinica.clinical_history_entries
  FOR EACH ROW EXECUTE FUNCTION nodo_clinica.clinical_history_entries_append_only();

-- RLS: patients can read their own history. Doctors reach the table through the
-- service client (which bypasses RLS), matching the rest of the médico API.
ALTER TABLE nodo_clinica.clinical_history_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'nodo_clinica'
      AND tablename  = 'clinical_history_entries'
      AND policyname = 'clinical_history_patient_read'
  ) THEN
    CREATE POLICY "clinical_history_patient_read"
      ON nodo_clinica.clinical_history_entries
      FOR SELECT
      USING (
        patient_id IN (
          SELECT id FROM nodo_clinica.patients WHERE profile_id = auth.uid()
        )
      );
  END IF;
END;
$$;
