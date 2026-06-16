DO $$ 
DECLARE
  new_contract_id UUID := gen_random_uuid();
  my_org_id UUID := '6473d7c6-4e75-486b-8841-92974c03e6a5';
BEGIN
  INSERT INTO nodo_inmo.contracts (
    id, org_id, property_id, tenant_id, start_date, end_date, 
    rent_amount, currency, adjustment_index, adjustment_period_months, 
    contract_type, status, expenses_paid_by, notes
  ) VALUES (
    new_contract_id,
    my_org_id,
    '2eb21bbc-49f6-4379-84f7-4593290a7e9b',
    '28626ca9-cbe4-4cdf-9d73-2fef97375858',
    '2026-03-05',
    '2028-03-05',
    800000,
    'ARS',
    'IPC',
    4,
    'habitacional',
    'active',
    'tenant',
    'Contrato de prueba ALERTA DASHBOARD (cuatrimestral)'
  );

  INSERT INTO nodo_inmo.payments (
    id, org_id, contract_id, period, due_date, amount, currency, status
  ) VALUES (
    gen_random_uuid(),
    my_org_id,
    new_contract_id,
    '2026-06-01',
    '2026-06-05',
    800000,
    'ARS',
    'pending'
  );
END $$;
