-- professionals.phone / phone_verified_at used by onboarding but missing on some envs.

ALTER TABLE nodo_clinica.professionals
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
