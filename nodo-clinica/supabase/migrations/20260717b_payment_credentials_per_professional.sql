-- Migration: scope payment_credentials per professional instead of per org
--
-- payment_credentials previously had UNIQUE(org_id) only, meaning a whole
-- multi-doctor org silently shared ONE Mercado Pago account -- any doctor's
-- patient payments would land in whichever doctor last linked their
-- account. Each doctor must link their own account instead.
--
-- No professional_id was ever recorded on existing rows, so they can't be
-- reliably reattributed. Safe to clear since this feature is still in
-- testing (no real payments processed through it yet).

DELETE FROM nodo_clinica.payment_credentials;

ALTER TABLE nodo_clinica.payment_credentials
  DROP CONSTRAINT IF EXISTS payment_credentials_org_id_unique;

ALTER TABLE nodo_clinica.payment_credentials
  ADD COLUMN IF NOT EXISTS professional_id uuid;

ALTER TABLE nodo_clinica.payment_credentials
  ADD CONSTRAINT payment_credentials_professional_id_fkey
  FOREIGN KEY (professional_id)
  REFERENCES nodo_clinica.professionals (id)
  ON DELETE CASCADE;

ALTER TABLE nodo_clinica.payment_credentials
  ALTER COLUMN professional_id SET NOT NULL;

ALTER TABLE nodo_clinica.payment_credentials
  ADD CONSTRAINT payment_credentials_professional_id_unique UNIQUE (professional_id);
