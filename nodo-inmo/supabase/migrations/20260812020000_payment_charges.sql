-- nodo_inmo.payment_charges — monto cobrado por cada concepto de contrato,
-- para un cobro (payment) puntual. El monto varía mes a mes, a diferencia
-- del alquiler. `payments.expenses_amount` queda derivado de la suma de
-- estas filas para el pago correspondiente (ver sync_payment_charge
-- en la migración siguiente).

create table nodo_inmo.payment_charges (
  id          uuid          primary key default gen_random_uuid(),
  org_id      uuid          not null
                             references shared.organizations(id)
                             on delete cascade,
  payment_id  uuid          not null
                             references nodo_inmo.payments(id)
                             on delete cascade,
  concept_id  uuid          not null
                             references nodo_inmo.contract_charge_concepts(id)
                             on delete restrict,
  amount      numeric(15,2) not null default 0 check (amount >= 0),
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default clock_timestamp(),
  constraint payment_charges_unique unique (payment_id, concept_id)
);

create index payment_charges_org_id_idx     on nodo_inmo.payment_charges (org_id);
create index payment_charges_payment_id_idx on nodo_inmo.payment_charges (payment_id);
create index payment_charges_concept_id_idx on nodo_inmo.payment_charges (concept_id);

create trigger set_updated_at
  before update on nodo_inmo.payment_charges
  for each row
  execute function nodo_inmo.set_updated_at();

-- RLS — Template A (staff-shared), igual que nodo_inmo.payments.
alter table nodo_inmo.payment_charges enable row level security;

create policy "org_insert" on nodo_inmo.payment_charges
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
  );

create policy "org_update" on nodo_inmo.payment_charges
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
  );

create policy "org_delete" on nodo_inmo.payment_charges
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
  );

create policy "staff_select" on nodo_inmo.payment_charges
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role'
        = any (array['admin', 'agent', 'super_admin'])
  );
