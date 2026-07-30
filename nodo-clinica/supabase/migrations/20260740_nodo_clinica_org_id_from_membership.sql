-- RLS across nodo_clinica compared org_id against auth.jwt()->app_metadata->>org_id,
-- which is a claim SHARED across every Nodo product a user has an account in
-- (see syncClinicaAuthClaims in src/lib/clinic/clinic-org.ts, which intentionally
-- never overwrites it if the user already belongs to another node). A doctor
-- or patient who also has an account in another Nodo product (e.g.
-- nodo-finanzas) then carries THAT node's org_id/role in their JWT, and every
-- RLS policy here silently returned zero rows for them via the browser
-- client — while server-side routes stayed correct because auth-guard.ts
-- already resolves professionals/patients by user_id, the real source of
-- truth. Symptom: doctor got a 406 PGRST116 fetching an appointment to start
-- a video consult.
--
-- Fix: resolve org_id from professionals/patients (by user_id/profile_id)
-- instead of the shared JWT, falling back to the JWT only when the caller is
-- neither (e.g. platform admin accounts, which don't have this problem and
-- are unaffected). CLINIC_ORG_ID is a single fixed value for all of
-- nodo-clinica today, so this is purely "is this caller a real member" —
-- not a multi-tenant org_id resolution.
--
-- role = 'super_admin' / role IN ('admin','super_admin') checks elsewhere in
-- these same policies are untouched — those gate Nodo staff accounts, not
-- doctors/patients, and aren't known to hit this bug.

CREATE OR REPLACE FUNCTION nodo_clinica.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = nodo_clinica, public
AS $$
  SELECT COALESCE(
    (SELECT org_id FROM nodo_clinica.professionals WHERE user_id = auth.uid() LIMIT 1),
    (SELECT org_id FROM nodo_clinica.patients WHERE profile_id = auth.uid() LIMIT 1),
    (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  )
$$;

REVOKE EXECUTE ON FUNCTION nodo_clinica.current_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION nodo_clinica.current_org_id() FROM anon;
GRANT EXECUTE ON FUNCTION nodo_clinica.current_org_id() TO authenticated;

-- Every nodo_clinica policy compares org_id (or, for patient_health_profiles,
-- patients.org_id via a subquery) against the exact expression
-- `((auth.jwt() -> 'app_metadata' ->> 'org_id'))::uuid`. Replace only that
-- sub-expression, in place, across every policy that has it — this
-- preserves each policy's cmd/roles/permissive and any other condition
-- combined with it (e.g. the super_admin role check) untouched. Idempotent:
-- if a policy has already been migrated (or never had the pattern), it's
-- simply skipped.
DO $$
DECLARE
  pol record;
  old_pattern constant text := '(((( SELECT auth.jwt() AS jwt) -> ''app_metadata''::text) ->> ''org_id''::text))::uuid';
  new_expr constant text := 'nodo_clinica.current_org_id()';
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR pol IN
    SELECT policyname, tablename, cmd, qual, with_check, roles
    FROM pg_policies
    WHERE schemaname = 'nodo_clinica'
      AND (
        (qual IS NOT NULL AND qual LIKE '%app_metadata%org_id%')
        OR (with_check IS NOT NULL AND with_check LIKE '%app_metadata%org_id%')
      )
  LOOP
    new_qual := CASE WHEN pol.qual IS NULL THEN NULL ELSE replace(pol.qual, old_pattern, new_expr) END;
    new_check := CASE WHEN pol.with_check IS NULL THEN NULL ELSE replace(pol.with_check, old_pattern, new_expr) END;

    EXECUTE format('DROP POLICY %I ON nodo_clinica.%I', pol.policyname, pol.tablename);

    stmt := format('CREATE POLICY %I ON nodo_clinica.%I FOR %s TO %s',
                    pol.policyname, pol.tablename, pol.cmd, array_to_string(pol.roles, ', '));
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE stmt;
  END LOOP;
END $$;
