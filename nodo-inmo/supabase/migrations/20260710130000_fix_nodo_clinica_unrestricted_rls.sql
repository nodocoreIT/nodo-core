-- Fix UNRESTRICTED tables in nodo_clinica schema
-- ponytail: skip when nodo_clinica not provisioned (local inmo-only Supabase)

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'nodo_clinica' AND table_name = 'office_settings'
  ) THEN
    RAISE NOTICE 'skip fix_nodo_clinica_unrestricted_rls: clinica tables absent';
    RETURN;
  END IF;

  ALTER TABLE nodo_clinica.professionals ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'nodo_clinica' AND tablename = 'professionals' AND policyname = 'org_select'
  ) THEN
    CREATE POLICY "org_select" ON nodo_clinica.professionals
      FOR SELECT TO authenticated
      USING (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
    CREATE POLICY "org_insert" ON nodo_clinica.professionals
      FOR INSERT TO authenticated
      WITH CHECK (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
    CREATE POLICY "org_update" ON nodo_clinica.professionals
      FOR UPDATE TO authenticated
      USING  (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid)
      WITH CHECK (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
    CREATE POLICY "org_delete" ON nodo_clinica.professionals
      FOR DELETE TO authenticated
      USING (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
  END IF;

  ALTER TABLE nodo_clinica.office_settings ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'nodo_clinica' AND tablename = 'office_settings' AND policyname = 'org_select'
  ) THEN
    CREATE POLICY "org_select" ON nodo_clinica.office_settings
      FOR SELECT TO authenticated
      USING (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
    CREATE POLICY "org_insert" ON nodo_clinica.office_settings
      FOR INSERT TO authenticated
      WITH CHECK (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
    CREATE POLICY "org_update" ON nodo_clinica.office_settings
      FOR UPDATE TO authenticated
      USING  (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid)
      WITH CHECK (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
    CREATE POLICY "org_delete" ON nodo_clinica.office_settings
      FOR DELETE TO authenticated
      USING (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
  END IF;

  ALTER TABLE nodo_clinica.doctor_notifications ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'nodo_clinica' AND tablename = 'doctor_notifications' AND policyname = 'org_select'
  ) THEN
    CREATE POLICY "org_select" ON nodo_clinica.doctor_notifications
      FOR SELECT TO authenticated
      USING (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
    CREATE POLICY "org_insert" ON nodo_clinica.doctor_notifications
      FOR INSERT TO authenticated
      WITH CHECK (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
    CREATE POLICY "org_update" ON nodo_clinica.doctor_notifications
      FOR UPDATE TO authenticated
      USING  (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid)
      WITH CHECK (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
    CREATE POLICY "org_delete" ON nodo_clinica.doctor_notifications
      FOR DELETE TO authenticated
      USING (org_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
  END IF;
END $mig$;
