-- nodo_tienda.payments — payment records per order
--
-- Template B (admin-only): only admin role can read and write payment data.
-- Financial data is restricted to admin to limit PCI surface area and
-- prevent staff from viewing payment method details.

-- ---------------------------------------------------------------------------
-- 1. Table definition
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.payments (
  id         uuid          primary key default gen_random_uuid(),
  org_id     uuid          not null references shared.organizations(id) on delete cascade,
  order_id   uuid          not null references nodo_tienda.orders(id) on delete cascade,
  amount     numeric(12,2) not null,
  method     text          not null,
  status     text          not null default 'pending'
             check (status in ('pending', 'completed', 'failed', 'refunded')),
  reference  text,
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- 2. Indices
-- ---------------------------------------------------------------------------
create index if not exists payments_org_id_idx  on nodo_tienda.payments (org_id);
create index if not exists payments_order_id_idx on nodo_tienda.payments (order_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_tienda.payments
  for each row
  execute function nodo_tienda.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — Template B (admin-only)
-- ---------------------------------------------------------------------------
alter table nodo_tienda.payments enable row level security;

create policy "org_select" on nodo_tienda.payments
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_insert" on nodo_tienda.payments
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_update" on nodo_tienda.payments
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_delete" on nodo_tienda.payments
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
