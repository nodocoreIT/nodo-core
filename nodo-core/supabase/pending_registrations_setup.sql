-- Create pending registrations table for doctors registering in Clinica Virtual.
-- These requests must be verified by email before moving to the 'clients' table.
--
-- Run this in your Supabase SQL Editor.

create table if not exists nodo_core.pending_registrations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  plan text not null,
  password text not null, -- stored temporarily for provisioning upon verification
  verification_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Enable RLS (Service role can read/write, standard authenticated/anon has no access)
alter table nodo_core.pending_registrations enable row level security;

-- Policies
drop policy if exists "Service role only access" on nodo_core.pending_registrations;
create policy "Service role only access" on nodo_core.pending_registrations
  using (false)
  with check (false);
