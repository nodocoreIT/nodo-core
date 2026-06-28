-- Replace card_last_four with full card_number and add card_cvc
alter table nodo_core.onboarding_profiles
  add column if not exists card_number text,
  add column if not exists card_cvc text;
