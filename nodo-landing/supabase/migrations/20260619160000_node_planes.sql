-- Commercial plans per nodo (panel + onboarding pricing source of truth).
-- Annual monthly equivalent = monthly * 10 / 12 (2 months free on yearly billing).

create table if not exists nodo_core.planes (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null,
  code text not null,
  label text not null,
  price_monthly numeric(10, 2) not null check (price_monthly >= 0),
  price_annual_monthly numeric(10, 2) not null check (price_annual_monthly >= 0),
  currency text not null default 'USD',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (unit_code, code)
);

create index if not exists planes_unit_code_idx
  on nodo_core.planes (unit_code, sort_order);

comment on table nodo_core.planes is
  'Commercial plans per nodo module. price_annual_monthly is the per-month rate when billed yearly (10 months paid for 12).';

alter table nodo_core.planes enable row level security;

drop policy if exists planes_select on nodo_core.planes;
create policy planes_select on nodo_core.planes
  for select to authenticated
  using ((select nodo_core.is_team_member()));

drop policy if exists planes_insert on nodo_core.planes;
create policy planes_insert on nodo_core.planes
  for insert to authenticated
  with check ((select nodo_core.is_team_member()));

drop policy if exists planes_update on nodo_core.planes;
create policy planes_update on nodo_core.planes
  for update to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

drop policy if exists planes_delete on nodo_core.planes;
create policy planes_delete on nodo_core.planes
  for delete to authenticated
  using ((select nodo_core.is_team_member()));

insert into nodo_core.planes (unit_code, code, label, price_monthly, price_annual_monthly, currency, sort_order)
values
  ('Inmo', 'starter', 'Starter', 75.00, round(75.00 * 10 / 12, 2), 'USD', 1),
  ('Inmo', 'pro', 'Pro', 125.00, round(125.00 * 10 / 12, 2), 'USD', 2),
  ('Finanzas', 'unico', 'Plan único', 4.99, round(4.99 * 10 / 12, 2), 'USD', 1),
  ('Autos', 'starter', 'Starter', 49.00, round(49.00 * 10 / 12, 2), 'USD', 1),
  ('Autos', 'pro', 'Pro', 99.00, round(99.00 * 10 / 12, 2), 'USD', 2),
  ('Autos', 'elite', 'Elite', 199.00, round(199.00 * 10 / 12, 2), 'USD', 3)
on conflict (unit_code, code) do update set
  label = excluded.label,
  price_monthly = excluded.price_monthly,
  price_annual_monthly = excluded.price_annual_monthly,
  currency = excluded.currency,
  sort_order = excluded.sort_order,
  is_active = true;
