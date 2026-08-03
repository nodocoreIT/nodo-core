-- Cross-nodo audit log of Terms & Conditions acceptances during onboarding.
-- One row per (unit_code, user, terms_version) — a version bump requires a
-- fresh acceptance, but the same person can accept independently per nodo.
--
-- Denormalized on purpose: full_name/document_number/email are captured at
-- acceptance time instead of FK'd into any nodo's own onboarding tables.
-- Each nodo has its own onboarding pipeline and pending-registration shape
-- (nodo_core.pending_registrations vs nodo_clinica.pending_clinic_registrations,
-- etc.), and a legal acceptance record should stand on its own even if the
-- source row is later edited or deleted.

create table if not exists nodo_core.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null,
  user_id uuid not null references auth.users(id),
  role text not null,
  full_name text not null,
  document_number text,
  email text not null,
  terms_version text not null,
  terms_content text not null,
  ip_address inet not null,
  accepted_at timestamptz not null default now(),
  unique (unit_code, user_id, terms_version)
);

create index if not exists terms_acceptances_user_id_idx
  on nodo_core.terms_acceptances (user_id);

comment on table nodo_core.terms_acceptances is
  'Cross-nodo audit log of Terms & Conditions acceptances (onboarding). unit_code identifies which nodo (e.g. "Clínica", "Inmo") the acceptance belongs to — must match nodo_core.client_units/planes.unit_code exactly (case/accent-sensitive). Denormalized full_name/document_number/email are a legal snapshot at acceptance time, independent of each nodo''s own onboarding tables.';

-- Enable RLS; service role bypasses it. Writes only happen server-side,
-- per-nodo, during onboarding — no insert/update/delete policy is defined
-- for `authenticated`, only an admin-facing read.
alter table nodo_core.terms_acceptances enable row level security;

drop policy if exists terms_acceptances_select on nodo_core.terms_acceptances;
create policy terms_acceptances_select on nodo_core.terms_acceptances
  for select to authenticated
  using ((select nodo_core.is_team_member()));
