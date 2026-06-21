-- Allow agents to read org_profiles for their own org.
-- This enables the guest dashboard to display the org's branding (theme colors, logo).
CREATE POLICY "agent_select" ON nodo_inmo.org_profiles
  FOR SELECT TO authenticated
  USING (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    AND (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'agent'
  );
