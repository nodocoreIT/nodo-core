-- nodo_tienda.org_profiles — per-org store configuration
--
-- Template B (admin-only): only admin role can read and write.
-- InitPlan-friendly RLS form throughout.
--
-- updated_at trigger: set_updated_at() is defined once here in the
-- nodo_tienda schema and reused by all subsequent business table migrations.

-- ---------------------------------------------------------------------------
-- 1. updated_at trigger function
--    SECURITY DEFINER so it can fire without relying on invoker privileges.
--    Empty search_path prevents search-path injection.
--    Idempotent: OR REPLACE.
-- ---------------------------------------------------------------------------
create or replace function nodo_tienda.set_updated_at()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- clock_timestamp() returns real wall time, unlike now() which is frozen
  -- to the transaction start. This ensures updated_at always advances on UPDATE
  -- even within the same transaction.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Table definition
-- ---------------------------------------------------------------------------
create table if not exists nodo_tienda.org_profiles (
  id               uuid        primary key default gen_random_uuid(),
  org_id           uuid        not null unique references shared.organizations(id) on delete cascade,
  store_name       text,
  tagline          text,
  contact_email    text,
  contact_phone    text,
  address          text,
  city             text,
  country          text        not null default 'AR',
  currency         text        not null default 'ARS',
  timezone         text        not null default 'America/Argentina/Buenos_Aires',
  theme_settings   jsonb,
  tax_settings     jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- 3. Indices
-- ---------------------------------------------------------------------------
create index if not exists org_profiles_org_id_idx on nodo_tienda.org_profiles (org_id);

-- ---------------------------------------------------------------------------
-- 4. updated_at trigger
-- ---------------------------------------------------------------------------
create trigger set_updated_at
  before update on nodo_tienda.org_profiles
  for each row
  execute function nodo_tienda.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS — Template B (admin-only)
--    Four explicit policies (SELECT / INSERT / UPDATE / DELETE).
--    Only admin role may operate on org_profiles.
-- ---------------------------------------------------------------------------
alter table nodo_tienda.org_profiles enable row level security;

create policy "org_select" on nodo_tienda.org_profiles
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_insert" on nodo_tienda.org_profiles
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_update" on nodo_tienda.org_profiles
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

create policy "org_delete" on nodo_tienda.org_profiles
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
