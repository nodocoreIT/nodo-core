INSERT INTO nodo_inmo.payments (
  id,
  org_id,
  contract_id,
  period,
  due_date,
  amount,
  currency,
  status
) VALUES (
  gen_random_uuid(),
  '27c8cee7-3158-43ca-a7d1-550fbd631a53',
  '630bdb6f-4e47-42e6-9f48-c2c6fa590284',
  '2026-06-01',
  '2026-06-05',
  500000,
  'ARS',
  'pending'
);
