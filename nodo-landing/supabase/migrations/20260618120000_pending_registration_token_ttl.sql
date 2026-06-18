-- Verification tokens: reusable until expiry, then refresh via resend.
alter table nodo_core.pending_registrations
  add column if not exists verified_at timestamptz;

alter table nodo_core.pending_registrations
  add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');

create index if not exists pending_registrations_token_idx
  on nodo_core.pending_registrations (verification_token);
