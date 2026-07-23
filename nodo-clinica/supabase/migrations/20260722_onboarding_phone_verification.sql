-- Onboarding: celular verificado por OTP (SMS)

ALTER TABLE nodo_clinica.pending_clinic_registrations
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

ALTER TABLE nodo_clinica.professionals
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

ALTER TABLE nodo_clinica.patients
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS nodo_clinica.phone_verification_challenges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_token uuid NOT NULL,
  phone_e164       text NOT NULL,
  code_hash        text NOT NULL,
  expires_at       timestamptz NOT NULL,
  verified_at      timestamptz,
  attempt_count    int NOT NULL DEFAULT 0,
  send_count       int NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_verification_challenges_token_idx
  ON nodo_clinica.phone_verification_challenges (onboarding_token, created_at DESC);

ALTER TABLE nodo_clinica.phone_verification_challenges ENABLE ROW LEVEL SECURITY;
