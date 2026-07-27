-- Same bug class as patients_profile_id_unique: professionals had no unique
-- constraint on user_id, so two onboarding submissions for the same auth user
-- (e.g. retried after an activation-link failure) each inserted a new row
-- instead of the second one updating the first — producing duplicate doctors,
-- sometimes with different subscription_plan values from each attempt.
--
-- Dedupe: keep the earliest-created row per user_id, repoint every FK across
-- the database that references professionals(id) to the keeper, merge any
-- non-null fields the keeper is missing, then drop the losing row(s).
--
-- NOTE on subscription_plan/subscription_status: COALESCE only fills NULLs —
-- if the keeper (earliest row) already has a plan set, the losing row's
-- (possibly different) plan is NOT merged in, it's simply discarded with the
-- row. If the wrong plan survives for a given doctor, fix it manually after
-- this runs — this migration won't guess which of two conflicting business
-- values (e.g. trial vs pro) is the correct one.

DO $$
DECLARE
  dup record;
  keeper_id uuid;
  loser_id uuid;
  fk record;
BEGIN
  FOR dup IN
    SELECT user_id
    FROM nodo_clinica.professionals
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING count(*) > 1
  LOOP
    SELECT id INTO keeper_id
    FROM nodo_clinica.professionals
    WHERE user_id = dup.user_id
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    FOR loser_id IN
      SELECT id FROM nodo_clinica.professionals
      WHERE user_id = dup.user_id AND id <> keeper_id
    LOOP
      FOR fk IN
        SELECT
          n.nspname AS schema_name,
          c.relname AS table_name,
          a.attname AS column_name
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN unnest(con.conkey) AS k(attnum) ON true
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
        WHERE con.contype = 'f'
          AND con.confrelid = 'nodo_clinica.professionals'::regclass
      LOOP
        BEGIN
          EXECUTE format(
            'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
            fk.schema_name, fk.table_name, fk.column_name, fk.column_name
          ) USING keeper_id, loser_id;
        EXCEPTION WHEN unique_violation THEN
          -- 1:1 table (e.g. office_settings, FK column is also its unique key):
          -- keeper already has a row here, so just drop the loser's.
          EXECUTE format(
            'DELETE FROM %I.%I WHERE %I = $1',
            fk.schema_name, fk.table_name, fk.column_name
          ) USING loser_id;
        END;
      END LOOP;

      UPDATE nodo_clinica.professionals k
      SET
        first_name = COALESCE(k.first_name, l.first_name),
        last_name = COALESCE(k.last_name, l.last_name),
        full_name = COALESCE(NULLIF(k.full_name, ''), l.full_name),
        specialty = COALESCE(k.specialty, l.specialty),
        license_number = COALESCE(k.license_number, l.license_number),
        phone = COALESCE(NULLIF(k.phone, ''), l.phone),
        subscription_status = COALESCE(k.subscription_status, l.subscription_status),
        subscription_plan = COALESCE(k.subscription_plan, l.subscription_plan)
      FROM nodo_clinica.professionals l
      WHERE k.id = keeper_id AND l.id = loser_id;

      DELETE FROM nodo_clinica.professionals WHERE id = loser_id;
    END LOOP;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'professionals_user_id_unique'
      AND conrelid = 'nodo_clinica.professionals'::regclass
  ) THEN
    ALTER TABLE nodo_clinica.professionals
      ADD CONSTRAINT professionals_user_id_unique UNIQUE (user_id);
  END IF;
END $$;
