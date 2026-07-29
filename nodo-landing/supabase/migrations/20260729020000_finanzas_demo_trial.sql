-- Nodo Finanzas has a single paid plan ("unico") with no free tier — add a
-- one-time 7-day demo so prospects can try before paying.
--
-- trial_ends_at lives on client_units (generic, reusable per unit_code) rather
-- than a Finanzas-specific schema, since client_units already models "this
-- client has this plan on this node". Scoped to unit_code = 'Finanzas' in the
-- trigger below so it never affects other nodes' rows.

alter table nodo_core.client_units
  add column if not exists trial_ends_at timestamptz;

-- Stamps trial_ends_at exactly once, the first time a Finanzas client_unit's
-- plan is (or becomes) 'demo'. Once set, it is never reset — re-selecting
-- 'demo' later does not grant a second trial window.
create or replace function nodo_core.set_finanzas_demo_trial_ends_at()
returns trigger
language plpgsql
as $$
begin
  if new.unit_code = 'Finanzas' and new.plan = 'demo' and new.trial_ends_at is null then
    new.trial_ends_at := now() + interval '7 days';
  end if;
  return new;
end;
$$;

drop trigger if exists client_units_set_finanzas_demo_trial on nodo_core.client_units;
create trigger client_units_set_finanzas_demo_trial
  before insert or update on nodo_core.client_units
  for each row execute function nodo_core.set_finanzas_demo_trial_ends_at();

insert into nodo_core.planes (unit_code, code, label, price_monthly, price_annual_monthly, currency, sort_order)
values ('Finanzas', 'demo', 'Demo (7 días)', 0.00, 0.00, 'USD', 0)
on conflict (unit_code, code) do update set
  label = excluded.label,
  price_monthly = excluded.price_monthly,
  price_annual_monthly = excluded.price_annual_monthly,
  currency = excluded.currency,
  sort_order = excluded.sort_order,
  is_active = true;
