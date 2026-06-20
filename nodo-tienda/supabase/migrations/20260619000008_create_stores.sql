-- nodo_tienda.stores — per-org storefront configuration
--
-- Template B (admin-only for writes, admin+staff for reads).
-- Reuses nodo_tienda.set_updated_at() defined in the org_profiles migration.

-- ---------------------------------------------------------------------------
-- 1. Table definition
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.stores (
  id                   uuid        primary key default gen_random_uuid(),
  org_id               uuid        not null references shared.organizations(id) on delete cascade,
  slug                 text        not null,
  name                 text        not null,
  description          text,
  logo_url             text,
  favicon_url          text,
  custom_domain        text        unique,
  domain_verified_at   timestamptz,
  domain_verify_token  text,
  is_active            boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default clock_timestamp(),
  unique (org_id, slug)
);

-- ---------------------------------------------------------------------------
-- 2. Indices
-- ---------------------------------------------------------------------------
create index if not exists stores_org_id_idx     on nodo_tienda.stores (org_id);
create index if not exists stores_slug_idx        on nodo_tienda.stores (slug);
create index if not exists stores_custom_domain_idx on nodo_tienda.stores (custom_domain)
  where custom_domain is not null;

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_tienda.stores
  for each row
  execute function nodo_tienda.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS — admin+staff read, admin-only write
-- ---------------------------------------------------------------------------
alter table nodo_tienda.stores enable row level security;

create policy "org_select" on nodo_tienda.stores
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'staff')
  );

create policy "org_insert" on nodo_tienda.stores
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_update" on nodo_tienda.stores
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_delete" on nodo_tienda.stores
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
