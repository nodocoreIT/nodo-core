-- nodo_tienda.inventory_movements — append-only stock ledger
--
-- Template A (staff-shared): admin+staff can SELECT and INSERT.
-- No UPDATE or DELETE policy — this is a ledger; rows are immutable after insert.
-- reference_id is a polymorphic FK placeholder (e.g. order_id) without a DB FK
-- constraint to avoid cross-table coupling.

-- ---------------------------------------------------------------------------
-- 1. Table definition
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.inventory_movements (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references shared.organizations(id) on delete cascade,
  product_id   uuid        not null references nodo_tienda.products(id) on delete cascade,
  variant_id   uuid        references nodo_tienda.product_variants(id) on delete set null,
  type         text        not null
               check (type in ('in', 'out', 'adjustment', 'reservation', 'release')),
  quantity     integer     not null,
  reason       text,
  reference_id uuid,
  performed_by uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Indices
-- ---------------------------------------------------------------------------
create index if not exists inventory_movements_org_id_idx     on nodo_tienda.inventory_movements (org_id);
create index if not exists inventory_movements_product_id_idx on nodo_tienda.inventory_movements (product_id);
create index if not exists inventory_movements_org_created_idx on nodo_tienda.inventory_movements (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. RLS — select + insert for admin+staff; no update/delete (append-only)
-- ---------------------------------------------------------------------------
alter table nodo_tienda.inventory_movements enable row level security;

create policy "org_select" on nodo_tienda.inventory_movements
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.inventory_movements
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );
