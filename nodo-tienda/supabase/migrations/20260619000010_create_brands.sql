-- nodo_tienda.brands — product brands catalog
--
-- Template A (staff-shared): admin+staff can read and write.
-- Supports soft delete via deleted_at.

-- ---------------------------------------------------------------------------
-- 1. Table definition
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.brands (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references shared.organizations(id) on delete cascade,
  name        text        not null,
  slug        text        not null,
  description text,
  logo_url    text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default clock_timestamp(),
  unique (org_id, slug)
);

-- ---------------------------------------------------------------------------
-- 2. Indices
-- ---------------------------------------------------------------------------
create index if not exists brands_org_id_idx on nodo_tienda.brands (org_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_tienda.brands
  for each row
  execute function nodo_tienda.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — Template A (admin+staff read/write)
-- ---------------------------------------------------------------------------
alter table nodo_tienda.brands enable row level security;

create policy "org_select" on nodo_tienda.brands
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.brands
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_update" on nodo_tienda.brands
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_delete" on nodo_tienda.brands
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );
