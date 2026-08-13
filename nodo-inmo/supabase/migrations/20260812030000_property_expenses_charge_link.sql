-- Vincula property_expenses con el payment_charge que la originó, para las
-- deducciones auto-generadas por conceptos de contrato retenidos por la
-- inmobiliaria (ver sync_payment_charge en la migración siguiente).
--
-- on delete set null (no cascade): si se borra el payment_charge de origen,
-- una deducción ya sellada en una rendición (applied_settlement_id not null)
-- no debe desaparecer del historial — solo pierde el vínculo.

alter table nodo_inmo.property_expenses
  add column payment_charge_id uuid
    references nodo_inmo.payment_charges(id)
    on delete set null;

create unique index property_expenses_payment_charge_id_key
  on nodo_inmo.property_expenses (payment_charge_id)
  where payment_charge_id is not null;

-- Ampliar el check de `type` para permitir gastos auto-generados desde un
-- concepto de contrato. El nombre del constraint original (autogenerado por
-- Postgres a partir del check inline en create_property_expenses.sql) no se
-- hardcodea: se ubica por su definición para no fallar si difiere.
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'nodo_inmo.property_expenses'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%arreglo%';

  if v_conname is not null then
    execute format('alter table nodo_inmo.property_expenses drop constraint %I', v_conname);
  end if;
end $$;

alter table nodo_inmo.property_expenses
  add constraint property_expenses_type_check
  check (type in ('arreglo', 'compra_accesorio', 'concepto_contrato'));
