-- nodo_tienda.customers — buyer/contact registry
--
-- Template A (staff-shared): admin+staff can read and write.
-- Supports soft delete via deleted_at.
-- total_spent is a denormalized aggregate updated by the order pipeline;
-- it avoids expensive aggregations on orders at query time.

-- ---------------------------------------------------------------------------
-- 1. Table definition
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.customers (
  id               uuid          primary key default gen_random_uuid(),
  org_id           uuid          not null references shared.organizations(id) on delete cascade,
  first_name       text          not null,
  last_name        text          not null,
  email            text,
  phone            text,
  document_number  text,
  address          text,
  city             text,
  notes            text,
  total_spent      numeric(12,2) not null default 0,
  last_purchase_at timestamptz,
  tags             text[],
  deleted_at       timestamptz,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- 2. Indices
-- ---------------------------------------------------------------------------
create index if not exists customers_org_id_idx       on nodo_tienda.customers (org_id);
create index if not exists customers_org_email_idx    on nodo_tienda.customers (org_id, email)
  where email is not null;
create index if not exists customers_org_spent_idx    on nodo_tienda.customers (org_id, total_spent desc);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_tienda.customers
  for each row
  execute function nodo_tienda.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — Template A (admin+staff read/write)
-- ---------------------------------------------------------------------------
alter table nodo_tienda.customers enable row level security;

create policy "org_select" on nodo_tienda.customers
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.customers
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_update" on nodo_tienda.customers
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_delete" on nodo_tienda.customers
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );
