-- Each doctor links their OWN MercadoPago account (payment_credentials is
-- per-professional). A leftover UNIQUE(org_id) constraint was blocking the
-- second doctor in an org from linking — the OAuth callback's upsert failed
-- with 23505 "payment_credentials_org_id_key already exists", so credentials
-- were never stored and the dialog kept showing "Vincular mi cuenta".
--
-- Migration 20260717b tried to drop it as `payment_credentials_org_id_unique`,
-- but the live constraint is named `payment_credentials_org_id_key` (Postgres'
-- default for an inline UNIQUE column), so the DROP never matched. Drop any
-- single-column UNIQUE constraint on org_id, whatever its name.

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'nodo_clinica'
      AND rel.relname = 'payment_credentials'
      AND con.contype = 'u'
      AND con.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
          WHERE attrelid = rel.oid AND attname = 'org_id' AND NOT attisdropped)
      ]
  LOOP
    EXECUTE format(
      'ALTER TABLE nodo_clinica.payment_credentials DROP CONSTRAINT %I',
      c.conname
    );
  END LOOP;
END $$;

-- Also drop a bare unique index on org_id if one exists without a constraint.
DROP INDEX IF EXISTS nodo_clinica.payment_credentials_org_id_key;

-- Ensure the correct per-professional uniqueness is in place (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_credentials_professional_id_unique'
      AND conrelid = 'nodo_clinica.payment_credentials'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.payment_credentials
      ADD CONSTRAINT payment_credentials_professional_id_unique UNIQUE (professional_id);
  END IF;
END $$;
