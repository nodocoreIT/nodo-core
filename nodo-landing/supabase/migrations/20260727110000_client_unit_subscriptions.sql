-- Per-client_unit MercadoPago subscription state (platform-subscription-billing,
-- Phase 1). One row per client_unit — mirrors the single active Preapproval per
-- unit described in design.md. Reuses the existing nodo_core.planes catalog for
-- pricing; this table only tracks the live subscription/Preapproval state.
--
-- billing_amount/billing_currency snapshot the actual ARS debited at each cycle
-- (planes.price_monthly is USD; ARS = USD * dólar-tarjeta rate on debit day).
-- Writes come from server-only code using the service_role admin client
-- (bypasses RLS); the policies below cover panel/team access via a normal
-- authenticated session.

create table if not exists nodo_core.client_unit_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_unit_id uuid not null unique references nodo_core.client_units (id) on delete cascade,
  plane_id uuid not null references nodo_core.planes (id),
  mp_preapproval_id text unique,
  billing_currency text not null default 'ARS',
  billing_amount numeric(12, 2) not null check (billing_amount >= 0),
  cycle_started_at timestamptz not null,
  next_due_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'past_due', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_unit_subscriptions_plane_idx
  on nodo_core.client_unit_subscriptions (plane_id);

create index if not exists client_unit_subscriptions_next_due_idx
  on nodo_core.client_unit_subscriptions (next_due_at);

comment on table nodo_core.client_unit_subscriptions is
  'Live MercadoPago Preapproval state per client_unit (NODO is payer of record). status: active|past_due|paused — distinct from client_units.status (activo|pausado|impago|...).';

alter table nodo_core.client_unit_subscriptions enable row level security;

drop policy if exists client_unit_subscriptions_select on nodo_core.client_unit_subscriptions;
create policy client_unit_subscriptions_select on nodo_core.client_unit_subscriptions
  for select to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists client_unit_subscriptions_insert on nodo_core.client_unit_subscriptions;
create policy client_unit_subscriptions_insert on nodo_core.client_unit_subscriptions
  for insert to authenticated
  with check ((select nodo_core.is_team_member()));

drop policy if exists client_unit_subscriptions_update on nodo_core.client_unit_subscriptions;
create policy client_unit_subscriptions_update on nodo_core.client_unit_subscriptions
  for update to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

drop policy if exists client_unit_subscriptions_delete on nodo_core.client_unit_subscriptions;
create policy client_unit_subscriptions_delete on nodo_core.client_unit_subscriptions
  for delete to authenticated
  using ((select nodo_core.is_team_member()));
