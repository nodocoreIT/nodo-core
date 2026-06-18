-- Archive contracts instead of hard-deleting them.
-- Keeps paid history; cancels pending cuotas and pending rendiciones.

alter table nodo_inmo.contracts
  add column if not exists archived_at timestamptz;

comment on column nodo_inmo.contracts.archived_at is
  'When set, contract is archived: hidden from operational views; paid history retained.';

create index if not exists contracts_archived_at_idx
  on nodo_inmo.contracts (archived_at)
  where archived_at is not null;

create or replace function nodo_inmo.archive_contract(p_contract_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_org_id  uuid;
  v_jwt_org uuid;
begin
  v_jwt_org := ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid;

  select org_id
    into v_org_id
  from nodo_inmo.contracts
  where id = p_contract_id;

  if v_org_id is null then
    raise exception 'Contrato no encontrado';
  end if;

  if v_org_id is distinct from v_jwt_org then
    raise exception 'Sin permiso para archivar este contrato';
  end if;

  if exists (
    select 1 from nodo_inmo.contracts
    where id = p_contract_id and archived_at is not null
  ) then
    return;
  end if;

  -- Remove pending rendiciones tied to unpaid cuotas.
  delete from nodo_inmo.owner_settlements os
  using nodo_inmo.payments p
  where p.id = os.payment_id
    and p.contract_id = p_contract_id
    and p.status = 'pending'
    and os.status = 'pending';

  -- Cancel unpaid installments; paid cuotas stay for history.
  update nodo_inmo.payments
  set
    status     = 'cancelled',
    updated_at = now()
  where contract_id = p_contract_id
    and status = 'pending';

  update nodo_inmo.contracts
  set
    status      = 'terminated',
    archived_at = now(),
    updated_at  = now()
  where id = p_contract_id;
end;
$$;

revoke all on function nodo_inmo.archive_contract(uuid) from public;
grant execute on function nodo_inmo.archive_contract(uuid) to authenticated;
