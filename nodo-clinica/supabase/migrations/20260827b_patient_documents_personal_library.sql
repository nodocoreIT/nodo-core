-- "Mis estudios" (patient personal studies library): PRO patients can upload
-- and manage study files without an appointment. appointment_id becomes
-- nullable — appointment_id IS NULL is the discriminator for these
-- "personal" rows (see sdd/mis-estudios/design). study_order_id is added now,
-- unwired, so a future doctor-ordered-studies fulfillment flow can link back
-- to this row without another migration.
--
-- Live-audit note: this session had no working live DB access (Supabase CLI
-- `db query --linked` returned 403 — Management API login role rejected for
-- the current token; no MCP tool available; no SUPABASE_DB_PASSWORD in env).
-- Both ALTERs below are written to be safe regardless of the current live
-- state:
--   - `DROP NOT NULL` on an already-nullable column is a no-op in Postgres
--     (does not error), so this is safe to apply even if appointment_id
--     already allows NULL.
--   - org_id is guarded by an explicit existence check so it only changes
--     when currently NOT NULL. patients.org_id is already nullable (see
--     nodo_clinica.current_org_id() in 20260740 and the `org_id: user.org_id
--     ?? null` insert in src/app/api/clinic/patients/route.ts), so a personal
--     document belonging to a patient without an org must not be blocked by
--     a NOT NULL constraint here either.
-- Recommended before applying to prod: confirm both columns' current
-- nullability with
--   SELECT column_name, is_nullable FROM information_schema.columns
--   WHERE table_schema = 'nodo_clinica' AND table_name = 'patient_documents'
--     AND column_name IN ('appointment_id', 'org_id');

ALTER TABLE nodo_clinica.patient_documents ALTER COLUMN appointment_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'nodo_clinica'
      AND table_name = 'patient_documents'
      AND column_name = 'org_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE nodo_clinica.patient_documents ALTER COLUMN org_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE nodo_clinica.patient_documents
  ADD COLUMN IF NOT EXISTS study_order_id uuid
    REFERENCES nodo_clinica.study_orders(id) ON DELETE SET NULL;

-- No backfill: existing rows keep their appointment_id and org_id exactly as
-- they are. This migration is purely additive/widening — no data changes.
