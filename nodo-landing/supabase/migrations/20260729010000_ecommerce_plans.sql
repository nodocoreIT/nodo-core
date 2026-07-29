-- Launch pricing for Nodo Ecommerce (previously had zero rows in nodo_core.planes).
-- Prices are provisional placeholders, to be revisited.

insert into nodo_core.planes (unit_code, code, label, price_monthly, price_annual_monthly, currency, sort_order)
values
  ('Ecommerce', 'starter', 'Starter', 20.00, round(20.00 * 10 / 12, 2), 'USD', 1),
  ('Ecommerce', 'pro', 'Pro', 50.00, round(50.00 * 10 / 12, 2), 'USD', 2),
  ('Ecommerce', 'elite', 'Elite', 100.00, round(100.00 * 10 / 12, 2), 'USD', 3)
on conflict (unit_code, code) do update set
  label = excluded.label,
  price_monthly = excluded.price_monthly,
  price_annual_monthly = excluded.price_annual_monthly,
  currency = excluded.currency,
  sort_order = excluded.sort_order,
  is_active = true;
