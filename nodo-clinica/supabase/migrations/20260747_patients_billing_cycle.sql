-- Patient's chosen billing cycle preference at onboarding (their paid plan
-- doesn't charge until they trigger checkout later from settings, but this
-- keeps the choice they made instead of silently discarding it).

alter table nodo_clinica.patients
  add column if not exists billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual'));
