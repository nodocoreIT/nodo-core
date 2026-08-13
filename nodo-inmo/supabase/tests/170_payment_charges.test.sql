-- Test: contract_charge_concepts + payment_charges → sync_payment_charge trigger
--
-- Covers:
--   1. payments.expenses_amount stays derived as the sum of payment_charges.
--   2. A concept with retained_by_agency=true auto-generates a deduction in
--      property_expenses (type='concepto_contrato', charged_to_owner=true).
--   3. A concept with retained_by_agency=false never generates a deduction.
--   4. Turning off retention / zeroing the amount removes the deduction —
--      unless it was already sealed into a rendición (applied_settlement_id).
--   5. An agent (not just admin) can register a payment_charge for a
--      retained concept — proves the trigger's security definer works
--      despite property_expenses being admin-only in RLS.
--   6. settle_owner deducts the retained amount from the owner's net.
begin;
select plan(15);

insert into auth.users (id, email, encrypted_password, created_at, updated_at) values
  ('f1000000-0000-0000-0000-000000000001', 'admin-f@test.local', 'x', now(), now()),
  ('f2000000-0000-0000-0000-000000000002', 'agent-f@test.local', 'x', now(), now());

insert into shared.organizations (id, name, tier) values
  ('f0000000-0000-0000-0000-000000000001', 'Org F', 'starter');

insert into shared.org_members (org_id, user_id, role) values
  ('f0000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'admin'),
  ('f0000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'agent');

insert into nodo_inmo.contacts (id, org_id, name, roles, commission_rate) values
  ('f0000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-000000000001', 'Owner F',  array['owner']::text[], 10.00),
  ('f0000000-0000-0000-0000-0000000000a2', 'f0000000-0000-0000-0000-000000000001', 'Tenant F', array['tenant']::text[], 0);

insert into nodo_inmo.properties (id, org_id, owner_id, address, operation, property_type, status, currency) values
  ('f0000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000a1', 'Calle F 100', 'rent', 'apartment', 'available', 'ARS');

insert into nodo_inmo.contracts (id, org_id, property_id, tenant_id, start_date, end_date, rent_amount) values
  ('f0000000-0000-0000-0000-0000000000c1', 'f0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000b1', 'f0000000-0000-0000-0000-0000000000a2', '2026-01-01', '2027-01-01', 400000);

insert into nodo_inmo.contract_charge_concepts (id, org_id, contract_id, label, retained_by_agency) values
  ('f0000000-0000-0000-0000-0000000000g1', 'f0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000c1', 'Municipal', true),
  ('f0000000-0000-0000-0000-0000000000g2', 'f0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000c1', 'Expensas', false);

insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount) values
  ('f0000000-0000-0000-0000-0000000000d1', 'f0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000c1', '2026-01-01', '2026-01-10', 400000);

-- As agent: load both charges for the January cobro.
set local role authenticated;
set local request.jwt.claims = '{"sub":"f2000000-0000-0000-0000-000000000002","app_metadata":{"memberships":{"inmo":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"agent"}}}}';

insert into nodo_inmo.payment_charges (id, org_id, payment_id, concept_id, amount) values
  ('f0000000-0000-0000-0000-0000000000h1', 'f0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000d1', 'f0000000-0000-0000-0000-0000000000g1', 20000),
  ('f0000000-0000-0000-0000-0000000000h2', 'f0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000d1', 'f0000000-0000-0000-0000-0000000000g2', 50000);

set local role postgres;

-- 1. expenses_amount derived = 20000 + 50000 = 70000
select is(
  (select expenses_amount from nodo_inmo.payments where id = 'f0000000-0000-0000-0000-0000000000d1'),
  70000.00,
  'payments.expenses_amount is derived as the sum of payment_charges');

-- 2. Retained concept (Municipal) auto-generates a property_expenses deduction
select is(
  (select count(*)::int from nodo_inmo.property_expenses
   where payment_charge_id = 'f0000000-0000-0000-0000-0000000000h1'
     and charged_to_owner = true
     and type = 'concepto_contrato'
     and amount = 20000
     and description = 'Municipal'),
  1,
  'retained concept auto-generates a charged_to_owner property_expenses row');

-- 3. Non-retained concept (Expensas) never generates a deduction
select is(
  (select count(*)::int from nodo_inmo.property_expenses
   where payment_charge_id = 'f0000000-0000-0000-0000-0000000000h2'),
  0,
  'non-retained concept never generates a property_expenses row');

-- Mark the cobro paid → commission trigger fires (on rent only: 400000 * 10% = 40000)
set local role postgres;
update nodo_inmo.payments set status = 'paid', paid_date = '2026-01-08'
where id = 'f0000000-0000-0000-0000-0000000000d1';

select is(
  (select amount from nodo_inmo.cash_movements
   where payment_id = 'f0000000-0000-0000-0000-0000000000d1' and source = 'commission'),
  40000.00,
  'commission on the mixed cobro is still computed on rent only (400000 * 10%), not on gross');

-- 4. Turn off retention on Municipal → the linked deduction is removed
set local role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000001","app_metadata":{"memberships":{"inmo":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"admin"}}}}';

update nodo_inmo.payment_charges set amount = 0
where id = 'f0000000-0000-0000-0000-0000000000h1';

set local role postgres;
select is(
  (select count(*)::int from nodo_inmo.property_expenses
   where payment_charge_id = 'f0000000-0000-0000-0000-0000000000h1'),
  0,
  'zeroing a retained charge removes its unsealed deduction');

-- Re-raise the amount so the golden seal below has something to deduct.
set local role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000001","app_metadata":{"memberships":{"inmo":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"admin"}}}}';

update nodo_inmo.payment_charges set amount = 20000
where id = 'f0000000-0000-0000-0000-0000000000h1';

set local role postgres;
select is(
  (select count(*)::int from nodo_inmo.property_expenses
   where payment_charge_id = 'f0000000-0000-0000-0000-0000000000h1'
     and amount = 20000),
  1,
  're-raising the amount re-creates the deduction');

-- 5. settle_owner deducts the retained Municipal amount from the owner net.
set local role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000001","app_metadata":{"memberships":{"inmo":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"admin"}}}}';

do $$
declare
  v_sid uuid;
  v_bd  jsonb;
begin
  select id into v_sid from nodo_inmo.owner_settlements
    where payment_id = 'f0000000-0000-0000-0000-0000000000d1';

  select nodo_inmo.settle_owner(
    'f0000000-0000-0000-0000-0000000000a1'::uuid,
    'f0000000-0000-0000-0000-0000000000b1'::uuid,
    'ARS',
    array[v_sid]
  ) into v_bd;
end $$;

set local role postgres;

-- owner_share (pre-deduction) = gross(470000) - commission(40000) = 430000
select is(
  (select (breakdown->>'owner_share')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'f0000000-0000-0000-0000-0000000000d1'),
  430000.00,
  'settle_owner: owner_share = gross (rent + both charges) - commission (rent-only)');

-- deduction_total = 20000 (only the retained Municipal charge)
select is(
  (select (breakdown->>'deduction_total')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'f0000000-0000-0000-0000-0000000000d1'),
  20000.00,
  'settle_owner: deduction_total equals the retained concept amount only');

-- net = 430000 - 20000 = 410000 (the non-retained Expensas 50000 passed through untouched)
select is(
  (select (breakdown->>'net')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'f0000000-0000-0000-0000-0000000000d1'),
  410000.00,
  'settle_owner: net deducts only the retained concept, non-retained one passes through');

-- The deduction description carries the concept label
select is(
  (select breakdown->'deductions'->0->>'description' from nodo_inmo.owner_settlements
   where payment_id = 'f0000000-0000-0000-0000-0000000000d1'),
  'Municipal',
  'settle_owner: the sealed deduction shows the concept label');

-- charges: the non-retained Expensas concept (50000) is itemized, Municipal
-- (retained) is NOT duplicated here — it only lives in deductions.
select is(
  (select breakdown->'charges' from nodo_inmo.owner_settlements
   where payment_id = 'f0000000-0000-0000-0000-0000000000d1'),
  '[{"label": "Expensas", "amount": 50000}]'::jsonb,
  'settle_owner: charges itemizes only the non-retained concept, by label');

-- rent_net_of_commission = rent(400000) - commission(40000) = 360000
select is(
  (select (breakdown->>'rent_net_of_commission')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'f0000000-0000-0000-0000-0000000000d1'),
  360000.00,
  'settle_owner: rent_net_of_commission = rent_gross - commission, for the end-of-statement subtotal');

-- commission_rate must divide by rent_gross (400000), not gross (470000) —
-- regression guard for the rate-understatement bug.
select is(
  (select (breakdown->>'commission_rate')::numeric from nodo_inmo.owner_settlements
   where payment_id = 'f0000000-0000-0000-0000-0000000000d1'),
  10.00,
  'settle_owner: commission_rate reflects the real contract rate (10%), not diluted by gross');

-- 6. After sealing, deleting the payment_charge must NOT remove the sealed deduction.
set local role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000001","app_metadata":{"memberships":{"inmo":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"admin"}}}}';

delete from nodo_inmo.payment_charges where id = 'f0000000-0000-0000-0000-0000000000h1';

set local role postgres;
select is(
  (select count(*)::int from nodo_inmo.property_expenses
   where id in (
     select id from nodo_inmo.property_expenses
     where description = 'Municipal' and applied_settlement_id is not null
   )),
  1,
  'a sealed deduction survives deletion of its source payment_charge (applied_settlement_id guard)');

-- 7. Regression: a payment with expenses_amount set directly (legacy path,
-- e.g. an installment generated before its contract had a concept
-- configured) has no matching payment_charges row. settle_owner must still
-- surface that money as a generic fallback line, not leave it unexplained.
set local role postgres;

insert into nodo_inmo.payments (id, org_id, contract_id, period, due_date, amount, expenses_amount) values
  ('f0000000-0000-0000-0000-0000000000d2', 'f0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-0000000000c1', '2026-02-01', '2026-02-10', 400000, 30000);

update nodo_inmo.payments set status = 'paid', paid_date = '2026-02-08'
where id = 'f0000000-0000-0000-0000-0000000000d2';

set local role authenticated;
set local request.jwt.claims = '{"sub":"f1000000-0000-0000-0000-000000000001","app_metadata":{"memberships":{"inmo":{"org_id":"f0000000-0000-0000-0000-000000000001","role":"admin"}}}}';

do $$
declare
  v_sid uuid;
begin
  select id into v_sid from nodo_inmo.owner_settlements
    where payment_id = 'f0000000-0000-0000-0000-0000000000d2';
  perform nodo_inmo.settle_owner(
    'f0000000-0000-0000-0000-0000000000a1'::uuid,
    'f0000000-0000-0000-0000-0000000000b1'::uuid,
    'ARS',
    array[v_sid]
  );
end $$;

set local role postgres;
select is(
  (select breakdown->'charges' from nodo_inmo.owner_settlements
   where payment_id = 'f0000000-0000-0000-0000-0000000000d2'),
  '[{"label": "Expensas / Otros (sin discriminar)", "amount": 30000}]'::jsonb,
  'settle_owner: untracked expenses_amount (no payment_charges row) surfaces as a generic fallback charge');

select * from finish();
rollback;
