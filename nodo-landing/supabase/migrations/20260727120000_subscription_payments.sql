-- Append-only payment history ledger per client_unit_subscriptions cycle
-- (platform-subscription-billing, Phase 1). Mirrors MP-reported outcomes
-- (webhook and/or reconciliation poll) — nodo-landing never self-initiates a
-- charge, so this table is a reconciliation record, not a charge queue.
--
-- fx_rate/fx_rate_source record the rate used for a successful ARS charge
-- (spec "Canonical Plan Pricing" / "FX Conversion" — MUST record the rate used
-- alongside the payment history entry). failure_reason distinguishes why an
-- attempt failed (e.g. 'fx_unavailable', 'mp_rejected') without overloading
-- `status`, per spec's "FX rate unavailable at charge time" scenario.

create table if not exists nodo_core.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references nodo_core.client_unit_subscriptions (id) on delete cascade,
  cycle_key text not null, -- e.g. '2026-07' anniversary cycle
  attempt_no integer not null default 1,
  mp_payment_id text,
  amount numeric(12, 2),
  fx_rate numeric(10, 4),
  fx_rate_source text,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  failure_reason text,
  created_at timestamptz not null default now(),
  unique (subscription_id, cycle_key, attempt_no)
);

create index if not exists subscription_payments_subscription_idx
  on nodo_core.subscription_payments (subscription_id, created_at desc);

comment on table nodo_core.subscription_payments is
  'Append-only ledger of MP-reported payment outcomes per subscription cycle. status: pending|approved|rejected. failure_reason (e.g. fx_unavailable) is set only when status = rejected.';

alter table nodo_core.subscription_payments enable row level security;

drop policy if exists subscription_payments_select on nodo_core.subscription_payments;
create policy subscription_payments_select on nodo_core.subscription_payments
  for select to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists subscription_payments_insert on nodo_core.subscription_payments;
create policy subscription_payments_insert on nodo_core.subscription_payments
  for insert to authenticated
  with check ((select nodo_core.is_team_member()));

drop policy if exists subscription_payments_update on nodo_core.subscription_payments;
create policy subscription_payments_update on nodo_core.subscription_payments
  for update to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

drop policy if exists subscription_payments_delete on nodo_core.subscription_payments;
create policy subscription_payments_delete on nodo_core.subscription_payments
  for delete to authenticated
  using ((select nodo_core.is_team_member()));
