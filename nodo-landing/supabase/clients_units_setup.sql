-- Clients restructure: split into clients (person/company) + client_units
-- (one row per nodo the client bought, with that module's access credentials).
--
-- Run this in the Supabase SQL Editor. Steps 1-3 are safe to run on existing
-- data. Step 4 (dropping migrated columns) is commented — run it only AFTER
-- verifying the app works with the new structure.
--
-- Access model: shared team resource (to authenticated using (true)), same as
-- the other panel tables. Credentials are stored as plain text, consistent with
-- vault_entries — this is an internal admin tool.

-- 1. Per-nodo table: what each client bought + how they log into that module.
create table if not exists public.client_units (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  unit_code text not null,
  plan text,
  status text not null default 'activo', -- activo | onboarding | pausado
  progress integer not null default 0 check (progress between 0 and 100),
  access_url text,
  access_user text,
  access_password text,
  created_at timestamptz not null default now()
);

create index if not exists client_units_client_id_idx on public.client_units (client_id);

alter table public.client_units enable row level security;

-- Idempotent: drop before create so the whole script can be re-run safely
-- (Postgres has no "create policy if not exists").
drop policy if exists "client_units_select" on public.client_units;
create policy "client_units_select" on public.client_units
  for select to authenticated using (true);

drop policy if exists "client_units_insert" on public.client_units;
create policy "client_units_insert" on public.client_units
  for insert to authenticated with check (true);

drop policy if exists "client_units_update" on public.client_units;
create policy "client_units_update" on public.client_units
  for update to authenticated using (true) with check (true);

drop policy if exists "client_units_delete" on public.client_units;
create policy "client_units_delete" on public.client_units
  for delete to authenticated using (true);

-- 2. New client-level contact columns.
alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists phone text;

-- 3. Migrate existing single-nodo clients into client_units (idempotent).
insert into public.client_units (client_id, unit_code, plan, status, progress)
select c.id, c.unit_code, c.plan, c.status, c.progress
from public.clients c
where c.unit_code is not null
  and not exists (select 1 from public.client_units cu where cu.client_id = c.id);

-- 4. After verifying the app, drop the columns that moved to client_units:
-- alter table public.clients drop column if exists unit_code;
-- alter table public.clients drop column if exists plan;
-- alter table public.clients drop column if exists status;
-- alter table public.clients drop column if exists progress;
-- alter table public.clients drop column if exists contact;
