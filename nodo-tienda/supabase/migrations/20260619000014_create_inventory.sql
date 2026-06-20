-- nodo_tienda.inventory — stock levels per product/variant
--
-- Template A (staff-shared): admin+staff can read and write.
-- variant_id is nullable: null variant_id means the stock is for the base
-- product (when has_variants = false). The unique constraint on
-- (product_id, variant_id) is declared WITHOUT NULLS NOT DISTINCT so that
-- two rows with the same product_id and variant_id = null are still rejected.

-- ---------------------------------------------------------------------------
-- 1. Table definition
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.inventory (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null references shared.organizations(id) on delete cascade,
  product_id          uuid        not null references nodo_tienda.products(id) on delete cascade,
  variant_id          uuid        references nodo_tienda.product_variants(id) on delete cascade,
  quantity            integer     not null default 0,
  reserved_quantity   integer     not null default 0,
  low_stock_threshold integer     default 5,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default clock_timestamp(),
  -- null variant_id = base product stock; treat nulls as equal so only one
  -- base-product row per product is allowed.
  unique nulls not distinct (product_id, variant_id)
);

-- ---------------------------------------------------------------------------
-- 2. Indices
-- ---------------------------------------------------------------------------
create index if not exists inventory_org_id_idx    on nodo_tienda.inventory (org_id);
create index if not exists inventory_product_id_idx on nodo_tienda.inventory (product_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_tienda.inventory
  for each row
  execute function nodo_tienda.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — Template A (admin+staff read/write)
-- ---------------------------------------------------------------------------
alter table nodo_tienda.inventory enable row level security;

create policy "org_select" on nodo_tienda.inventory
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.inventory
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_update" on nodo_tienda.inventory
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_delete" on nodo_tienda.inventory
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );
