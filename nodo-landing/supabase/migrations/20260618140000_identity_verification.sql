-- Identity verification (RENAPER / face match) during onboarding

alter table nodo_core.onboarding_profiles
  add column if not exists document_number text,
  add column if not exists gender text check (gender is null or gender in ('M', 'F', 'X'));

create table if not exists nodo_core.identity_verification_checks (
  id uuid primary key default gen_random_uuid(),
  client_unit_id uuid not null references nodo_core.client_units (id) on delete cascade,
  provider text not null,
  status text not null check (status in ('approved', 'declined', 'review', 'error', 'skipped')),
  outcome_code text not null,
  request_id text,
  face_match_score numeric,
  message text,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists identity_verification_checks_unit_idx
  on nodo_core.identity_verification_checks (client_unit_id, created_at desc);

alter table nodo_core.identity_verification_checks enable row level security;

drop policy if exists "identity_verification_checks_team" on nodo_core.identity_verification_checks;
create policy "identity_verification_checks_team" on nodo_core.identity_verification_checks
  for all to authenticated using (true) with check (true);

-- Allow selfie uploads in registration docs
alter table nodo_core.registration_verification_docs
  drop constraint if exists registration_verification_docs_doc_type_check;

alter table nodo_core.registration_verification_docs
  add constraint registration_verification_docs_doc_type_check
  check (doc_type in ('id_photo', 'selfie', 'credit_card', 'debit_card', 'payment_proof', 'other'));
