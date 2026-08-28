-- Optional "resume where you left off" destination for the register → verify
-- → onboarding chain. NULL means "no destination" — every existing caller
-- (doctor registration, plain patient registration) is unaffected since they
-- never set this column and the fallback stays /login.
ALTER TABLE nodo_clinica.pending_clinic_registrations
  ADD COLUMN IF NOT EXISTS next_path text;

COMMENT ON COLUMN nodo_clinica.pending_clinic_registrations.next_path IS
  'Optional post-onboarding redirect target (must start with /paciente or /medico). Set by callers like Recetas that need the user to land back on a specific page after completing registration+onboarding.';

-- Fase 3 of "Recetas" also needs to record when a médico sent a receta's
-- magic link to the patient. This column doesn't exist yet on
-- nodo_clinica.prescriptions (it wasn't part of the Fase 2 migration) — added
-- here, additively, rather than opening a second migration file for one
-- column. Same "no live DB access this session" caveat as prior migrations:
-- ADD COLUMN IF NOT EXISTS is a no-op if it's already there.
ALTER TABLE nodo_clinica.prescriptions
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;
