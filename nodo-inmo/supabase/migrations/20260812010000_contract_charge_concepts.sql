-- nodo_inmo.contract_charge_concepts — conceptos de cargo configurables por
-- contrato (ej. "Expensas", "Municipal", "Impuesto de gas"), de nombre libre.
-- Cada concepto marca si el monto cobrado por ese concepto lo retiene la
-- inmobiliaria (se descuenta después en la rendición vía property_expenses)
-- o va íntegro al propietario.
--
-- Soft-delete via `active`: nunca se borra físicamente un concepto que ya
-- tenga payment_charges asociados (evita el error de FK on delete restrict
-- y preserva el historial de cobros/rendiciones ya selladas).

create table nodo_inmo.contract_charge_concepts (
  id                 uuid          primary key default gen_random_uuid(),
  org_id             uuid          not null
                                    references shared.organizations(id)
                                    on delete cascade,
  contract_id        uuid          not null
                                    references nodo_inmo.contracts(id)
                                    on delete cascade,
  label              text          not null check (length(trim(label)) > 0),
  retained_by_agency boolean       not null default false,
  active             boolean       not null default true,
  sort_order         int           not null default 0,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default clock_timestamp()
);

create index contract_charge_concepts_org_id_idx
  on nodo_inmo.contract_charge_concepts (org_id);
create index contract_charge_concepts_contract_id_idx
  on nodo_inmo.contract_charge_concepts (contract_id)
  where active = true;

create trigger set_updated_at
  before update on nodo_inmo.contract_charge_concepts
  for each row
  execute function nodo_inmo.set_updated_at();

-- RLS — Template A (staff-shared): org-scoped write for any staff role,
-- select restricted to admin/agent/super_admin. Mirrors nodo_inmo.payments
-- and nodo_inmo.contracts under the memberships.inmo claim (post
-- 20260729060000_migrate_rls_to_memberships_map.sql).
alter table nodo_inmo.contract_charge_concepts enable row level security;

create policy "org_insert" on nodo_inmo.contract_charge_concepts
  for insert to authenticated
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
  );

create policy "org_update" on nodo_inmo.contract_charge_concepts
  for update to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
  )
  with check (
    org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
  );

create policy "org_delete" on nodo_inmo.contract_charge_concepts
  for delete to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
  );

create policy "staff_select" on nodo_inmo.contract_charge_concepts
  for select to authenticated
  using (
    org_id = ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid
    and (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role'
        = any (array['admin', 'agent', 'super_admin'])
  );
