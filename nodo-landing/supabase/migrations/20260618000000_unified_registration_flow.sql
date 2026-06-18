-- Unified cross-node registration flow
-- Run in Supabase SQL Editor (nodo_core schema on landing project).

-- ─── Extend pending_registrations ───────────────────────────────────────────
alter table nodo_core.pending_registrations
  add column if not exists unit_code text not null default 'Salud';

alter table nodo_core.pending_registrations
  add column if not exists phone text;

-- Password optional: collected at onboarding after admin approval (not at signup).
alter table nodo_core.pending_registrations
  alter column password drop not null;

-- One pending request per email per node (same email can register different nodes).
alter table nodo_core.pending_registrations
  drop constraint if exists pending_registrations_email_key;

create unique index if not exists pending_registrations_email_unit_unique
  on nodo_core.pending_registrations (email, unit_code);

-- ─── Extend client_units ────────────────────────────────────────────────────
alter table nodo_core.client_units
  add column if not exists provisioned_at timestamptz;

alter table nodo_core.client_units
  add column if not exists provision_user_id uuid;

alter table nodo_core.client_units
  add column if not exists docs_verified_at timestamptz;

alter table nodo_core.client_units
  add column if not exists enabled_at timestamptz;

alter table nodo_core.client_units
  add column if not exists admin_notes text;

-- Status lifecycle: pending_review → pending_onboarding → onboarding → activo | pausado
comment on column nodo_core.client_units.status is
  'pending_review | pending_onboarding | onboarding | activo | pausado';

create unique index if not exists client_units_client_unit_unique
  on nodo_core.client_units (client_id, unit_code);

-- ─── Node-scoped email access (DB enforcement) ────────────────────────────────
-- Same email may exist on multiple nodes, but only once per node.
create table if not exists nodo_core.node_email_access (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  unit_code text not null,
  client_id uuid not null references nodo_core.clients (id) on delete cascade,
  client_unit_id uuid not null references nodo_core.client_units (id) on delete cascade,
  status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  unique (email, unit_code)
);

create index if not exists node_email_access_client_unit_idx
  on nodo_core.node_email_access (client_unit_id);

alter table nodo_core.node_email_access enable row level security;

drop policy if exists "node_email_access_team" on nodo_core.node_email_access;
create policy "node_email_access_team" on nodo_core.node_email_access
  for all to authenticated using (true) with check (true);

-- ─── Verification documents (ID photo, payment proof, etc.) ─────────────────
create table if not exists nodo_core.registration_verification_docs (
  id uuid primary key default gen_random_uuid(),
  client_unit_id uuid not null references nodo_core.client_units (id) on delete cascade,
  doc_type text not null check (doc_type in ('id_photo', 'credit_card', 'debit_card', 'payment_proof', 'other')),
  storage_path text not null,
  file_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references nodo_core.profiles (id),
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now()
);

create index if not exists registration_verification_docs_unit_idx
  on nodo_core.registration_verification_docs (client_unit_id);

alter table nodo_core.registration_verification_docs enable row level security;

drop policy if exists "registration_verification_docs_team" on nodo_core.registration_verification_docs;
create policy "registration_verification_docs_team" on nodo_core.registration_verification_docs
  for all to authenticated using (true) with check (true);

-- ─── Activation tokens (post-admin enable → onboarding link) ─────────────────
create table if not exists nodo_core.activation_tokens (
  id uuid primary key default gen_random_uuid(),
  client_unit_id uuid not null references nodo_core.client_units (id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists activation_tokens_client_unit_idx
  on nodo_core.activation_tokens (client_unit_id);

alter table nodo_core.activation_tokens enable row level security;

drop policy if exists "activation_tokens_service" on nodo_core.activation_tokens;
create policy "activation_tokens_service" on nodo_core.activation_tokens
  using (false) with check (false);

-- ─── Onboarding profile (collected after activation email) ──────────────────
create table if not exists nodo_core.onboarding_profiles (
  client_unit_id uuid primary key references nodo_core.client_units (id) on delete cascade,
  first_name text,
  last_name text,
  address text,
  city text,
  province text,
  phone text,
  plan_choice text check (plan_choice in ('starter', 'pro', 'demo')),
  demo_days integer check (demo_days is null or demo_days between 1 and 90),
  username text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table nodo_core.onboarding_profiles enable row level security;

drop policy if exists "onboarding_profiles_team" on nodo_core.onboarding_profiles;
create policy "onboarding_profiles_team" on nodo_core.onboarding_profiles
  for all to authenticated using (true) with check (true);

-- ─── Storage bucket for verification docs (private) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('registration-docs', 'registration-docs', false, 10485760)
on conflict (id) do nothing;
