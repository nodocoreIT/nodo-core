-- Shared tenant tables

-- ---------------------------------------------------------------------------
-- organizations (tenant anchor)
-- ---------------------------------------------------------------------------
create table if not exists shared.organizations (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  tier       text        not null default 'starter'
                         check (tier in ('starter', 'pro')),
  product    text        not null default 'tienda',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- org_members (user <-> org <-> role)
-- ---------------------------------------------------------------------------
create table if not exists shared.org_members (
  org_id     uuid not null references shared.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null
             check (role in ('admin', 'staff', 'customer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_idx on shared.org_members (user_id);

-- ---------------------------------------------------------------------------
-- user_profiles (cross-nodo identity / display)
-- ---------------------------------------------------------------------------
create table if not exists shared.user_profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- indices (IPC/ICL reference data)
-- ---------------------------------------------------------------------------
create table if not exists shared.indices (
  id         uuid           primary key default gen_random_uuid(),
  kind       text           not null check (kind in ('IPC', 'ICL')),
  period     date           not null,
  value      numeric(15, 6) not null,
  source     text           not null default 'INDEC',
  created_at timestamptz    not null default now(),
  unique (kind, period)
);

-- ---------------------------------------------------------------------------
-- nodo_id (Pro / Phase 2 placeholder — structure only)
-- ---------------------------------------------------------------------------
create table if not exists shared.nodo_id (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references shared.organizations(id) on delete cascade,
  product    text        not null,
  created_at timestamptz not null default now(),
  unique (org_id, product)
);
