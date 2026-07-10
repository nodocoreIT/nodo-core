-- Fix UNRESTRICTED tables in nodo_clinica schema
--
-- Three tables have RLS disabled (shown as UNRESTRICTED in the Supabase dashboard):
--   - professionals
--   - office_settings
--   - doctor_notifications
--
-- This migration enables RLS on all three and adds the standard
-- InitPlan-friendly org_id isolation policies (Template A, staff-shared).
--
-- doctor_notifications: all data access uses createServiceClient() (service_role),
-- which bypasses RLS. Enabling RLS here closes the gap in case any future
-- code path uses the authenticated client directly.

-- ---------------------------------------------------------------------------
-- 1. professionals
-- ---------------------------------------------------------------------------
alter table nodo_clinica.professionals enable row level security;

create policy "org_select" on nodo_clinica.professionals
  for select to authenticated
  using (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);

create policy "org_insert" on nodo_clinica.professionals
  for insert to authenticated
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);

create policy "org_update" on nodo_clinica.professionals
  for update to authenticated
  using  (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid)
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);

create policy "org_delete" on nodo_clinica.professionals
  for delete to authenticated
  using (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);

-- ---------------------------------------------------------------------------
-- 2. office_settings
-- ---------------------------------------------------------------------------
alter table nodo_clinica.office_settings enable row level security;

create policy "org_select" on nodo_clinica.office_settings
  for select to authenticated
  using (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);

create policy "org_insert" on nodo_clinica.office_settings
  for insert to authenticated
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);

create policy "org_update" on nodo_clinica.office_settings
  for update to authenticated
  using  (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid)
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);

create policy "org_delete" on nodo_clinica.office_settings
  for delete to authenticated
  using (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);

-- ---------------------------------------------------------------------------
-- 3. doctor_notifications
--    All current reads/writes go through createServiceClient() (service_role),
--    which bypasses RLS. Enabling RLS here with org_id policies protects
--    against direct authenticated client access.
-- ---------------------------------------------------------------------------
alter table nodo_clinica.doctor_notifications enable row level security;

create policy "org_select" on nodo_clinica.doctor_notifications
  for select to authenticated
  using (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);

create policy "org_insert" on nodo_clinica.doctor_notifications
  for insert to authenticated
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);

create policy "org_update" on nodo_clinica.doctor_notifications
  for update to authenticated
  using  (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid)
  with check (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);

create policy "org_delete" on nodo_clinica.doctor_notifications
  for delete to authenticated
  using (org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid);
