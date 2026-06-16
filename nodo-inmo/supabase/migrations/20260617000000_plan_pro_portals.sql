-- Plan Pro Portals — reclamos table + portal-scoped RLS policies
--
-- What this migration does:
--   1. Creates nodo_inmo.reclamos (tenant complaint workflow)
--   2. Hardens existing Template-A policies on contracts, payments, properties,
--      contacts and owner_settlements so that tenant/owner auth users can only
--      see their own data, while staff (admin + agent) retain full org-scoped
--      access. Previously the org_id check alone was enough for staff; tenants
--      and owners with org_id in their JWT would have passed the same check.
--
-- RLS pattern used for portal roles:
--   - staff_select  → org_id match AND role in ('admin','agent')
--   - tenant_select → data belongs to the contact linked to auth.uid()
--   - owner_select  → data belongs to properties owned by contact linked to auth.uid()
--   - self_select   → the contacts row whose portal_user_id = auth.uid()
--
-- All policies keep the InitPlan sub-select form: (select auth.jwt()) and
-- (select auth.uid()) are evaluated once per statement, not once per row.

-- ─── 1. RECLAMOS TABLE ───────────────────────────────────────────────────────

create table nodo_inmo.reclamos (
  id           uuid         primary key default gen_random_uuid(),
  org_id       uuid         not null references shared.organizations(id) on delete cascade,
  contact_id   uuid         not null references nodo_inmo.contacts(id)  on delete cascade,
  property_id  uuid         references nodo_inmo.properties(id) on delete set null,
  contract_id  uuid         references nodo_inmo.contracts(id)  on delete set null,
  title        text         not null,
  description  text         not null,
  category     text         not null default 'general'
               check (category in ('maintenance','payment','neighbor','general','other')),
  priority     text         not null default 'media'
               check (priority in ('alta','media','baja')),
  status       text         not null default 'open'
               check (status in ('open','in_progress','resolved','closed')),
  admin_notes  text,
  resolved_at  timestamptz,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default clock_timestamp()
);

create index reclamos_org_id_idx     on nodo_inmo.reclamos (org_id);
create index reclamos_contact_id_idx on nodo_inmo.reclamos (contact_id);
create index reclamos_status_idx     on nodo_inmo.reclamos (status);

create trigger set_updated_at
  before update on nodo_inmo.reclamos
  for each row execute function nodo_inmo.set_updated_at();

alter table nodo_inmo.reclamos enable row level security;

-- Staff: full CRUD on all org reclamos
create policy "staff_select" on nodo_inmo.reclamos
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin','agent')
  );

create policy "staff_insert" on nodo_inmo.reclamos
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin','agent')
  );

create policy "staff_update" on nodo_inmo.reclamos
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin','agent')
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin','agent')
  );

-- Tenants: see and create only their own reclamos
create policy "tenant_select" on nodo_inmo.reclamos
  for select to authenticated
  using (
    contact_id in (
      select id from nodo_inmo.contacts
      where portal_user_id = (select auth.uid())
    )
  );

create policy "tenant_insert" on nodo_inmo.reclamos
  for insert to authenticated
  with check (
    contact_id in (
      select id from nodo_inmo.contacts
      where portal_user_id = (select auth.uid())
    )
  );

-- ─── 2. CONTACTS — add self-read policy for portal users ────────────────────

drop policy if exists "org_select" on nodo_inmo.contacts;

-- Staff can see all contacts for their org
create policy "staff_select" on nodo_inmo.contacts
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin','agent')
  );

-- Portal users can read their own contact record
create policy "self_select" on nodo_inmo.contacts
  for select to authenticated
  using (
    portal_user_id = (select auth.uid())
  );

-- ─── 3. CONTRACTS — tenant + owner read ─────────────────────────────────────

drop policy if exists "org_select" on nodo_inmo.contracts;

create policy "staff_select" on nodo_inmo.contracts
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin','agent')
  );

-- Tenants: see contracts where they are the tenant party
create policy "tenant_select" on nodo_inmo.contracts
  for select to authenticated
  using (
    tenant_id in (
      select id from nodo_inmo.contacts
      where portal_user_id = (select auth.uid())
    )
  );

-- Owners: see contracts for properties they own
create policy "owner_select" on nodo_inmo.contracts
  for select to authenticated
  using (
    property_id in (
      select p.id from nodo_inmo.properties p
      join nodo_inmo.contacts c on c.id = p.owner_id
      where c.portal_user_id = (select auth.uid())
    )
  );

-- ─── 4. PAYMENTS — tenant read ───────────────────────────────────────────────

drop policy if exists "org_select" on nodo_inmo.payments;

create policy "staff_select" on nodo_inmo.payments
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin','agent')
  );

create policy "tenant_select" on nodo_inmo.payments
  for select to authenticated
  using (
    contract_id in (
      select ct.id from nodo_inmo.contracts ct
      join nodo_inmo.contacts c on c.id = ct.tenant_id
      where c.portal_user_id = (select auth.uid())
    )
  );

-- ─── 5. PROPERTIES — owner read ──────────────────────────────────────────────

drop policy if exists "org_select" on nodo_inmo.properties;

create policy "staff_select" on nodo_inmo.properties
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin','agent')
  );

create policy "owner_select" on nodo_inmo.properties
  for select to authenticated
  using (
    owner_id in (
      select id from nodo_inmo.contacts
      where portal_user_id = (select auth.uid())
    )
  );

-- ─── 6. OWNER_SETTLEMENTS — owner read ───────────────────────────────────────

-- The existing staff policy uses Template B (admin-only). We add an owner read.
create policy "owner_select" on nodo_inmo.owner_settlements
  for select to authenticated
  using (
    owner_id in (
      select id from nodo_inmo.contacts
      where portal_user_id = (select auth.uid())
    )
  );
