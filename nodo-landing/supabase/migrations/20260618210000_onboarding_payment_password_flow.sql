-- Payment + first-login password tracking (onboarding flow v2)
alter table nodo_core.onboarding_profiles
  add column if not exists card_holder text,
  add column if not exists card_last_four text,
  add column if not exists card_expiry text;

alter table nodo_core.client_units
  add column if not exists password_set_at timestamptz;
