-- nodo_tienda.products — core product catalog
--
-- Template A (staff-shared): admin+staff can read and write.
-- Supports soft delete via deleted_at.
-- has_variants flag signals to the application that price/stock lives on
-- product_variants instead of the base product row.

-- ---------------------------------------------------------------------------
-- 1. Table definition
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.products (
  id                uuid          primary key default gen_random_uuid(),
  org_id            uuid          not null references shared.organizations(id) on delete cascade,
  name              text          not null,
  slug              text          not null,
  sku               text,
  description       text,
  category_id       uuid          references nodo_tienda.categories(id) on delete set null,
  brand_id          uuid          references nodo_tienda.brands(id) on delete set null,
  price             numeric(12,2) not null default 0,
  promotional_price numeric(12,2),
  cost              numeric(12,2),
  is_active         boolean       not null default true,
  is_featured       boolean       not null default false,
  has_variants      boolean       not null default false,
  tags              text[],
  metadata          jsonb,
  deleted_at        timestamptz,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default clock_timestamp(),
  unique (org_id, slug)
);

-- ---------------------------------------------------------------------------
-- 2. Indices
-- ---------------------------------------------------------------------------
create index if not exists products_org_id_idx      on nodo_tienda.products (org_id);
create index if not exists products_category_id_idx on nodo_tienda.products (category_id);
create index if not exists products_brand_id_idx    on nodo_tienda.products (brand_id);
create index if not exists products_org_active_idx  on nodo_tienda.products (org_id, is_active)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_tienda.products
  for each row
  execute function nodo_tienda.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — Template A (admin+staff read/write)
-- ---------------------------------------------------------------------------
alter table nodo_tienda.products enable row level security;

create policy "org_select" on nodo_tienda.products
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.products
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_update" on nodo_tienda.products
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_delete" on nodo_tienda.products
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );
