-- nodo_tienda.product_images — ordered image gallery per product
--
-- Template A (staff-shared): admin+staff can write, admin+staff can read.
-- No updated_at needed: images are immutable once uploaded (replace by delete+insert).

-- ---------------------------------------------------------------------------
-- 1. Table definition
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.product_images (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references shared.organizations(id) on delete cascade,
  product_id uuid        not null references nodo_tienda.products(id) on delete cascade,
  url        text        not null,
  alt        text,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Indices
-- ---------------------------------------------------------------------------
create index if not exists product_images_org_id_idx    on nodo_tienda.product_images (org_id);
create index if not exists product_images_product_id_idx on nodo_tienda.product_images (product_id);

-- ---------------------------------------------------------------------------
-- 3. RLS — admin+staff read/write
-- ---------------------------------------------------------------------------
alter table nodo_tienda.product_images enable row level security;

create policy "org_select" on nodo_tienda.product_images
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.product_images
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_update" on nodo_tienda.product_images
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_delete" on nodo_tienda.product_images
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );
