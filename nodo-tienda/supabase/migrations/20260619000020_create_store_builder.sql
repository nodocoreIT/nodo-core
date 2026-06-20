-- nodo_tienda.store_menus — header/footer navigation configuration
-- nodo_tienda.store_sections — home-page content blocks (hero, featured, etc.)
--
-- Both tables are Template B (admin-only writes, admin+staff reads).
-- items / config are jsonb blobs managed entirely by the store builder UI.

-- ---------------------------------------------------------------------------
-- 1. store_menus
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.store_menus (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references shared.organizations(id) on delete cascade,
  location   text        not null check (location in ('header', 'footer')),
  items      jsonb       not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (org_id, location)
);

create index if not exists store_menus_org_id_idx on nodo_tienda.store_menus (org_id);

create trigger set_updated_at
  before update on nodo_tienda.store_menus
  for each row
  execute function nodo_tienda.set_updated_at();

alter table nodo_tienda.store_menus enable row level security;

create policy "org_select" on nodo_tienda.store_menus
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.store_menus
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_update" on nodo_tienda.store_menus
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_delete" on nodo_tienda.store_menus
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

-- ---------------------------------------------------------------------------
-- 2. store_sections
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.store_sections (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references shared.organizations(id) on delete cascade,
  type       text        not null
             check (type in ('hero', 'featured_products', 'categories', 'banner', 'text', 'custom')),
  title      text,
  config     jsonb       not null default '{}',
  sort_order integer     not null default 0,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists store_sections_org_id_idx on nodo_tienda.store_sections (org_id);

create trigger set_updated_at
  before update on nodo_tienda.store_sections
  for each row
  execute function nodo_tienda.set_updated_at();

alter table nodo_tienda.store_sections enable row level security;

create policy "org_select" on nodo_tienda.store_sections
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.store_sections
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_update" on nodo_tienda.store_sections
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_delete" on nodo_tienda.store_sections
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
