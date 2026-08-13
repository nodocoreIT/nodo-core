-- Sincroniza cada payment_charge con:
--   1. payments.expenses_amount — se mantiene como la suma derivada de todas
--      las payment_charges del pago (los consumidores existentes de
--      expenses_amount — post_payment_to_caja, settle_owner, generación de
--      cuotas — no cambian).
--   2. property_expenses — si el concepto está marcado "retenido por la
--      inmobiliaria", se mantiene una fila de gasto (charged_to_owner=true,
--      type='concepto_contrato') vinculada por payment_charge_id, que
--      alimenta la deducción ya existente en settle_owner. Si se apaga la
--      retención o el monto baja a 0, la fila vinculada se borra — salvo que
--      ya haya sido sellada en una rendición (applied_settlement_id not null),
--      en cuyo caso nunca se toca.
--
-- security definer: property_expenses es admin-only en RLS, pero los cobros
-- (payments/payment_charges) los puede registrar un agent. Sin
-- security definer, un agent cobrando un concepto retenido no podría generar
-- la deducción. Mismo patrón que nodo_inmo.post_payment_to_caja.

create or replace function nodo_inmo.sync_payment_charge()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_payment_id  uuid;
  v_org_id      uuid;
  v_property_id uuid;
  v_currency    text;
  v_period      date;
  v_retained    boolean;
  v_label       text;
begin
  v_payment_id := coalesce(new.payment_id, old.payment_id);

  update nodo_inmo.payments
     set expenses_amount = coalesce(
           (select sum(amount) from nodo_inmo.payment_charges where payment_id = v_payment_id),
           0)
   where id = v_payment_id;

  if tg_op = 'DELETE' then
    delete from nodo_inmo.property_expenses
     where payment_charge_id = old.id
       and applied_settlement_id is null;
    return old;
  end if;

  select c.retained_by_agency, c.label
    into v_retained, v_label
  from nodo_inmo.contract_charge_concepts c
  where c.id = new.concept_id;

  select p.org_id, p.currency, p.period, k.property_id
    into v_org_id, v_currency, v_period, v_property_id
  from nodo_inmo.payments p
  join nodo_inmo.contracts k on k.id = p.contract_id
  where p.id = new.payment_id;

  if coalesce(v_retained, false) and new.amount > 0 then
    insert into nodo_inmo.property_expenses
      (org_id, property_id, type, amount, currency, expense_date, description,
       charged_to_owner, payment_charge_id)
    values
      (v_org_id, v_property_id, 'concepto_contrato', new.amount, v_currency, v_period, v_label,
       true, new.id)
    on conflict (payment_charge_id) where payment_charge_id is not null
    do update set
      amount       = excluded.amount,
      description  = excluded.description,
      expense_date = excluded.expense_date,
      currency     = excluded.currency
    where nodo_inmo.property_expenses.applied_settlement_id is null;
  else
    delete from nodo_inmo.property_expenses
     where payment_charge_id = new.id
       and applied_settlement_id is null;
  end if;

  return new;
end;
$$;

create trigger sync_payment_charge
  after insert or update or delete on nodo_inmo.payment_charges
  for each row
  execute function nodo_inmo.sync_payment_charge();
