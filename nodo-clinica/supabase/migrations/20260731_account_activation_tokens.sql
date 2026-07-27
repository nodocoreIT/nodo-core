-- Custom activation tokens for admin-triggered account activation.
--
-- Replaces reliance on Supabase's single-use recovery link, whose session was
-- fragile: email-scanner prefetch consumed the one-time token before the user
-- clicked, the recovery session expired before the user finished typing, or a
-- stale localStorage session from a prior attempt was submitted — all surfacing
-- as "El enlace expiró o ya fue usado". Our own token is only consumed on the
-- password-submit POST (opening the page never spends it), has a lifetime we
-- control, and lives in this same project (no cross-project JWT validation).

CREATE TABLE IF NOT EXISTS nodo_clinica.account_activation_tokens (
  token       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  email       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('medico', 'paciente')),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_activation_tokens_email_idx
  ON nodo_clinica.account_activation_tokens (email);

-- Enable RLS; only the service role (used by the activation API routes) touches
-- this table. No user-facing policies needed.
ALTER TABLE nodo_clinica.account_activation_tokens ENABLE ROW LEVEL SECURITY;
