-- nodo_tienda.suppliers — vendor/supplier registry
-- nodo_tienda.supplier_products — supplier <-> product cost mapping
--
-- Template A (staff-shared): admin+staff can read and write.
-- Supports soft delete on suppliers via deleted_at.
-- supplier_products is a join table with an optional cost override per supplier.

-- ---------------------------------------------------------------------------
-- 1a. suppliers table
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.suppliers (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references shared.organizations(id) on delete cascade,
  name         text        not null,
  contact_name text,
  email        text,
  phone        text,
  address      text,
  notes        text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default clock_timestamp()
);

create index if not exists suppliers_org_id_idx on nodo_tienda.suppliers (org_id);

create trigger set_updated_at
  before update on nodo_tienda.suppliers
  for each row
  execute function nodo_tienda.set_updated_at();

alter table nodo_tienda.suppliers enable row level security;

create policy "org_select" on nodo_tienda.suppliers
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.suppliers
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_update" on nodo_tienda.suppliers
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_delete" on nodo_tienda.suppliers
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

-- ---------------------------------------------------------------------------
-- 1b. supplier_products join table
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.supplier_products (
  supplier_id uuid          not null references nodo_tienda.suppliers(id) on delete cascade,
  product_id  uuid          not null references nodo_tienda.products(id) on delete cascade,
  cost        numeric(12,2),
  notes       text,
  created_at  timestamptz   not null default now(),
  primary key (supplier_id, product_id)
);

create index if not exists supplier_products_product_id_idx on nodo_tienda.supplier_products (product_id);

alter table nodo_tienda.supplier_products enable row level security;

-- supplier_products has no org_id column; RLS uses the supplier's org_id via
-- a correlated subquery so the InitPlan optimization still applies to auth.jwt().
create policy "org_select" on nodo_tienda.supplier_products
  for select to authenticated
  using (
    exists (
      select 1 from nodo_tienda.suppliers s
      where s.id = supplier_id
        and s.org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    )
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.supplier_products
  for insert to authenticated
  with check (
    exists (
      select 1 from nodo_tienda.suppliers s
      where s.id = supplier_id
        and s.org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    )
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_update" on nodo_tienda.supplier_products
  for update to authenticated
  using (
    exists (
      select 1 from nodo_tienda.suppliers s
      where s.id = supplier_id
        and s.org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    )
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  )
  with check (
    exists (
      select 1 from nodo_tienda.suppliers s
      where s.id = supplier_id
        and s.org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    )
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_delete" on nodo_tienda.supplier_products
  for delete to authenticated
  using (
    exists (
      select 1 from nodo_tienda.suppliers s
      where s.id = supplier_id
        and s.org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    )
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );
