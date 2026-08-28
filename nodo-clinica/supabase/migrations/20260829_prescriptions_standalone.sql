-- Standalone prescriptions (Fase 2 of "Recetas"): a médico can build and save
-- a prescription outside of a live consultation — no appointment, and the
-- patient may not even be registered yet. appointment_id/patient_id become
-- nullable; NULL patient_id + non-null patient_email/patient_full_name is
-- the discriminator for an "unregistered patient" prescription.
--
-- The `prescriptions` table itself is NOT among this repo's tracked
-- migrations — its base schema was applied directly to Supabase in an
-- earlier, untracked step. Exactly like 20260827b_patient_documents_personal_
-- library.sql before it, this session has no live DB access to confirm
-- current nullability, so every statement below is written to be safe
-- regardless of the live state:
--   - `DROP NOT NULL` on an already-nullable column is a no-op in Postgres
--     (does not error), so this is safe to apply even if appointment_id/
--     patient_id already allow NULL.
--   - All `ADD COLUMN` use `IF NOT EXISTS`, so a rerun (or a column that was
--     already added by hand) never errors.
--   - The payment_status CHECK constraint is guarded by an explicit
--     pg_constraint existence check, matching the pattern Phase 1
--     (institutions) used for its own constraints.
-- Recommended before applying to prod: confirm current nullability with
--   SELECT column_name, is_nullable FROM information_schema.columns
--   WHERE table_schema = 'nodo_clinica' AND table_name = 'prescriptions'
--     AND column_name IN ('appointment_id', 'patient_id');

ALTER TABLE nodo_clinica.prescriptions ALTER COLUMN appointment_id DROP NOT NULL;
ALTER TABLE nodo_clinica.prescriptions ALTER COLUMN patient_id DROP NOT NULL;

ALTER TABLE nodo_clinica.prescriptions
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES nodo_clinica.institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS institution_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS price_amount numeric,
  ADD COLUMN IF NOT EXISTS price_currency text DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS access_token uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS mercadopago_preference_id text,
  ADD COLUMN IF NOT EXISTS mercadopago_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS patient_email text,
  ADD COLUMN IF NOT EXISTS patient_full_name text,
  ADD COLUMN IF NOT EXISTS notes text;

-- institution_snapshot captures {name, city, address, extraInfo} at the
-- moment the prescription is issued, so a later edit to the institution
-- (Fase 1) never rewrites history on an already-issued letterhead.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prescriptions_payment_status_check'
  ) THEN
    ALTER TABLE nodo_clinica.prescriptions
      ADD CONSTRAINT prescriptions_payment_status_check
      CHECK (payment_status IN ('pending', 'confirmed', 'waived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prescriptions_access_token ON nodo_clinica.prescriptions(access_token);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_email ON nodo_clinica.prescriptions(patient_email);

-- No backfill: existing rows keep their appointment_id/patient_id exactly as
-- they are. This migration is purely additive/widening — no data changes.
