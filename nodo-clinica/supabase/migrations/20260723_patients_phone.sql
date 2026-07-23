-- patients.phone / phone_verified_at used by onboarding but were missing on some envs.

ALTER TABLE nodo_clinica.patients
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
