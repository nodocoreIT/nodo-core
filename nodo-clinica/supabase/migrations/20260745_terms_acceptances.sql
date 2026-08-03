-- Migration: terms & conditions acceptance audit log (onboarding — médico y paciente)

CREATE TABLE IF NOT EXISTS nodo_clinica.terms_acceptances (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_registration_id  uuid NOT NULL REFERENCES nodo_clinica.pending_clinic_registrations(id),
  user_id                  uuid NOT NULL,
  role                     text NOT NULL CHECK (role IN ('medico', 'paciente')),
  terms_version            text NOT NULL,
  terms_content            text NOT NULL,
  ip_address               inet NOT NULL,
  accepted_at              timestamptz NOT NULL DEFAULT now()
);

-- Un registro pendiente acepta los términos una sola vez: si el usuario
-- recarga el modal y confirma de nuevo, el insert hace no-op (ON CONFLICT)
-- en vez de acumular filas duplicadas para el mismo onboarding.
CREATE UNIQUE INDEX IF NOT EXISTS terms_acceptances_pending_registration_id_key
  ON nodo_clinica.terms_acceptances (pending_registration_id);

-- Enable RLS; service role bypasses it. Writes only happen server-side during onboarding.
ALTER TABLE nodo_clinica.terms_acceptances ENABLE ROW LEVEL SECURITY;
