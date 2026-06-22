-- Fix staff Template-A SELECT (and reclamos write) policies for super_admin.
--
-- After 20260622000000 users are provisioned as super_admin, but
-- 20260617000000_plan_pro_portals staff_* policies only allow admin + agent.
-- INSERT still worked (org_insert checks org_id only) → POST 201/200 with null
-- body, then list queries return [] because staff_select blocks super_admin.

-- ─── reclamos ───────────────────────────────────────────────────────────────

drop policy if exists "staff_select" on nodo_inmo.reclamos;
create policy "staff_select" on nodo_inmo.reclamos
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'agent', 'super_admin')
  );

drop policy if exists "staff_insert" on nodo_inmo.reclamos;
create policy "staff_insert" on nodo_inmo.reclamos
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'agent', 'super_admin')
  );

drop policy if exists "staff_update" on nodo_inmo.reclamos;
create policy "staff_update" on nodo_inmo.reclamos
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'agent', 'super_admin')
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'agent', 'super_admin')
  );

-- ─── contacts ───────────────────────────────────────────────────────────────

drop policy if exists "staff_select" on nodo_inmo.contacts;
create policy "staff_select" on nodo_inmo.contacts
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'agent', 'super_admin')
  );

-- ─── contracts ──────────────────────────────────────────────────────────────

drop policy if exists "staff_select" on nodo_inmo.contracts;
create policy "staff_select" on nodo_inmo.contracts
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'agent', 'super_admin')
  );

-- ─── payments ───────────────────────────────────────────────────────────────

drop policy if exists "staff_select" on nodo_inmo.payments;
create policy "staff_select" on nodo_inmo.payments
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'agent', 'super_admin')
  );

-- ─── properties ─────────────────────────────────────────────────────────────

drop policy if exists "staff_select" on nodo_inmo.properties;
create policy "staff_select" on nodo_inmo.properties
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'agent', 'super_admin')
  );
