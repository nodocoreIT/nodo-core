-- Monto mensual de expensas definido en el contrato.
-- Se replica en cuotas pendientes y entra al bruto del cobro vía payments.expenses_amount.

alter table nodo_inmo.contracts
  add column if not exists expenses_amount numeric(15,2) not null default 0
    check (expenses_amount >= 0);
