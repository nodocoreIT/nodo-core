-- nodo_tienda.product_variants — size/color/other attribute combinations
--
-- Template A (staff-shared): admin+staff can read and write.
-- attributes is a free-form jsonb map: { "color": "rojo", "talle": "M" }
-- price_override / cost_override are null when the base product price applies.

-- ---------------------------------------------------------------------------
-- 1. Table definition
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.product_variants (
  id             uuid          primary key default gen_random_uuid(),
  org_id         uuid          not null references shared.organizations(id) on delete cascade,
  product_id     uuid          not null references nodo_tienda.products(id) on delete cascade,
  sku            text,
  attributes     jsonb         not null default '{}',
  price_override numeric(12,2),
  cost_override  numeric(12,2),
  is_active      boolean       not null default true,
  deleted_at     timestamptz,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- 2. Indices
-- ---------------------------------------------------------------------------
create index if not exists product_variants_org_id_idx    on nodo_tienda.product_variants (org_id);
create index if not exists product_variants_product_id_idx on nodo_tienda.product_variants (product_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_tienda.product_variants
  for each row
  execute function nodo_tienda.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — Template A (admin+staff read/write)
-- ---------------------------------------------------------------------------
alter table nodo_tienda.product_variants enable row level security;

create policy "org_select" on nodo_tienda.product_variants
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.product_variants
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_update" on nodo_tienda.product_variants
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_delete" on nodo_tienda.product_variants
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );
