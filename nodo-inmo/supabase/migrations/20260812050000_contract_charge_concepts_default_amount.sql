-- "Expensas" pasa a ser el primer concepto de contrato con un valor fijo por
-- defecto (a diferencia de Municipal/Gas/Luz, que varían mes a mes). Este
-- valor precarga automáticamente payment_charges al generar cuotas
-- (ver sync-contract-installments.ts), sin necesidad de cargarlo a mano en
-- cada cobro.

alter table nodo_inmo.contract_charge_concepts
  add column default_amount numeric(15,2)
    check (default_amount is null or default_amount >= 0);

-- Backfill: todo contrato con expenses_amount > 0 hoy migra su valor a un
-- concepto "Expensas" (no retenido — el campo viejo nunca tuvo esa
-- semántica), con sort_order 0 para que quede primero en la lista.
insert into nodo_inmo.contract_charge_concepts
  (org_id, contract_id, label, retained_by_agency, default_amount, sort_order)
select org_id, id, 'Expensas', false, expenses_amount, 0
from nodo_inmo.contracts
where expenses_amount > 0;
