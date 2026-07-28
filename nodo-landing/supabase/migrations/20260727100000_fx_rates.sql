-- Dólar-tarjeta FX rate snapshots, used to convert nodo_core.planes USD prices
-- to ARS at MercadoPago debit time (platform-subscription-billing, Phase 1).
--
-- Rows come from two sources:
--   'dolarapi'  — daily automated fetch (see app/api/cron/refresh-fx-rate)
--   'manual'    — admin override, last-resort fallback when the automated
--                 fetch has no usable rate (see lib/billing/fx-rate.ts)

create table if not exists nodo_core.fx_rates (
  id uuid primary key default gen_random_uuid(),
  rate_date date not null,
  rate numeric(10, 4) not null check (rate > 0),
  source text not null,
  created_at timestamptz not null default now(),
  unique (rate_date, source)
);

create index if not exists fx_rates_rate_date_idx
  on nodo_core.fx_rates (rate_date desc);

comment on table nodo_core.fx_rates is
  'Dólar-tarjeta FX rate snapshots used by lib/billing/fx-rate.ts to convert nodo_core.planes USD prices to ARS at debit time. source: "dolarapi" (daily fetch) | "manual" (admin override fallback).';

alter table nodo_core.fx_rates enable row level security;

drop policy if exists fx_rates_select on nodo_core.fx_rates;
create policy fx_rates_select on nodo_core.fx_rates
  for select to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists fx_rates_insert on nodo_core.fx_rates;
create policy fx_rates_insert on nodo_core.fx_rates
  for insert to authenticated
  with check ((select nodo_core.is_team_member()));

drop policy if exists fx_rates_update on nodo_core.fx_rates;
create policy fx_rates_update on nodo_core.fx_rates
  for update to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

drop policy if exists fx_rates_delete on nodo_core.fx_rates;
create policy fx_rates_delete on nodo_core.fx_rates
  for delete to authenticated
  using ((select nodo_core.is_team_member()));
