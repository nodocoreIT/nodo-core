-- Fix: settle_owner / annul_payment / archive_contract still read the flat
-- app_metadata.org_id/role JWT claim, which is a single global value shared
-- across every nodo product a user belongs to — it gets overwritten by
-- whichever product's token was refreshed most recently, not necessarily
-- inmo. RLS was already migrated off this claim on 2026-07-29
-- (20260729050000_claim_hook_memberships_map.sql +
-- 20260729060000_migrate_rls_to_memberships_map.sql) to the namespaced
-- app_metadata.memberships.inmo.{org_id,role,plan} slot, which the auth
-- hook recomputes fresh for every product on every token refresh — these
-- three RPCs were the only nodo_inmo functions left behind.
--
-- Confirmed root cause: a multi-nodo user (member of Inmo + Autos + Finanzas
-- + Clínica orgs) got "some settlements are missing, already settled, or
-- already sealed" from settle_owner on a genuinely pending, unsealed
-- settlement — the flat org_id claim pointed at a different nodo's org.

create or replace function nodo_inmo.settle_owner(
  p_owner_id        uuid,
  p_property_id     uuid,
  p_currency        text,
  p_settlement_ids  uuid[]
) returns jsonb
  language plpgsql
  set search_path = ''
as $$
declare
  v_org_id          uuid;
  v_group           uuid := gen_random_uuid();
  v_anchor_id       uuid;
  v_gross           numeric(15,2);
  v_rent_gross      numeric(15,2);
  v_expenses_gross  numeric(15,2);
  v_commission      numeric(15,2);
  v_net_owner       numeric(15,2);
  v_rate            numeric(5,2);
  v_deductions      jsonb;
  v_deduction_sum   numeric(15,2);
  v_net             numeric(15,2);
  v_today           date := current_date;
  v_breakdown       jsonb;
  v_cobros_detail   jsonb;
  v_charges         jsonb;
  v_charges_total   numeric(15,2);
  v_retained_total  numeric(15,2);
  v_untracked       numeric(15,2);
begin
  v_org_id := ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid;
  if (select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'role' not in ('admin', 'super_admin') then
    raise exception 'settle_owner: admin role required';
  end if;
  if p_settlement_ids is null or cardinality(p_settlement_ids) = 0 then
    raise exception 'settle_owner: no settlements provided';
  end if;

  perform 1
  from nodo_inmo.owner_settlements s
  where s.id = any(p_settlement_ids)
    and s.org_id = v_org_id
    and s.owner_id = p_owner_id
    and s.currency = p_currency
    and s.status = 'pending'
    and s.breakdown is null
  for update;

  if (select count(*) from nodo_inmo.owner_settlements s
        where s.id = any(p_settlement_ids)
          and s.org_id = v_org_id
          and s.owner_id = p_owner_id
          and s.currency = p_currency
          and s.status = 'pending'
          and s.breakdown is null) <> cardinality(p_settlement_ids) then
    raise exception 'settle_owner: some settlements are missing, already settled, or already sealed';
  end if;

  select id into v_anchor_id
  from nodo_inmo.owner_settlements
  where id = any(p_settlement_ids)
  order by id::text
  limit 1;

  select coalesce(sum(s.amount), 0)
    into v_net_owner
  from nodo_inmo.owner_settlements s
  where s.id = any(p_settlement_ids);

  select
    coalesce(sum(pm.amount), 0),
    coalesce(sum(coalesce(pm.expenses_amount, 0)), 0)
    into v_rent_gross, v_expenses_gross
  from nodo_inmo.owner_settlements s
  join nodo_inmo.payments pm on pm.id = s.payment_id
  where s.id = any(p_settlement_ids);

  v_gross := v_rent_gross + v_expenses_gross;

  select coalesce(sum(cm.amount), 0)
    into v_commission
  from nodo_inmo.owner_settlements s
  join nodo_inmo.cash_movements cm
    on cm.payment_id = s.payment_id and cm.source = 'commission'
  where s.id = any(p_settlement_ids);

  v_rate := case when v_rent_gross > 0
    then round(v_commission / v_rent_gross * 100, 2)
    else 0
  end;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'period',          to_char(pm.period, 'YYYY-MM-01'),
      'period_label',    to_char(pm.period, 'MM/YYYY'),
      'amount',          pm.amount,
      'expenses_amount', coalesce(pm.expenses_amount, 0)
    ) order by pm.period),
    '[]'::jsonb
  )
  into v_cobros_detail
  from nodo_inmo.owner_settlements s
  join nodo_inmo.payments pm on pm.id = s.payment_id
  where s.id = any(p_settlement_ids);

  select coalesce(
    jsonb_agg(jsonb_build_object('label', grouped.label, 'amount', grouped.amt) order by grouped.label),
    '[]'::jsonb
  )
  into v_charges
  from (
    select cc.label as label, sum(pc.amount) as amt
    from nodo_inmo.owner_settlements s
    join nodo_inmo.payment_charges pc on pc.payment_id = s.payment_id
    join nodo_inmo.contract_charge_concepts cc on cc.id = pc.concept_id
    where s.id = any(p_settlement_ids)
      and cc.retained_by_agency = false
      and pc.amount > 0
    group by cc.label
  ) grouped;

  with picked as (
    select e.id, e.amount, e.description, e.expense_date, e.type
    from nodo_inmo.property_expenses e
    where e.property_id = p_property_id
      and e.org_id = v_org_id
      and e.currency = p_currency
      and e.charged_to_owner = true
      and e.applied_settlement_id is null
    for update of e
  )
  select
    coalesce(sum(amount), 0),
    coalesce(
      jsonb_agg(jsonb_build_object(
        'id',           id,
        'amount',       amount,
        'description',  description,
        'expense_date', expense_date,
        'type',         type
      ) order by expense_date),
      '[]'::jsonb
    )
  into v_deduction_sum, v_deductions
  from picked;

  -- Reconcile: charges + retained-concept deductions should equal
  -- expenses_gross. Any gap (legacy/untracked expensas_amount with no
  -- matching payment_charges row) becomes a generic fallback line.
  select coalesce(sum((elem->>'amount')::numeric), 0)
    into v_charges_total
  from jsonb_array_elements(v_charges) elem;

  select coalesce(sum((elem->>'amount')::numeric), 0)
    into v_retained_total
  from jsonb_array_elements(v_deductions) elem
  where elem->>'type' = 'concepto_contrato';

  v_untracked := round(v_expenses_gross - v_charges_total - v_retained_total, 2);
  if v_untracked > 0.01 then
    v_charges := v_charges || jsonb_build_array(
      jsonb_build_object('label', 'Expensas / Otros (sin discriminar)', 'amount', v_untracked)
    );
  end if;

  v_net := v_net_owner - v_deduction_sum;

  v_breakdown := jsonb_build_object(
    'version',          3,
    'currency',         p_currency,
    'gross',            v_gross,
    'rent_gross',       v_rent_gross,
    'expenses_gross',   v_expenses_gross,
    'commission_rate',  v_rate,
    'commission',       v_commission,
    'owner_share',      v_net_owner,
    'charges',          v_charges,
    'rent_net_of_commission', v_rent_gross - v_commission,
    'deductions',       v_deductions,
    'deduction_total',  v_deduction_sum,
    'net',              v_net,
    'settlement_group', v_group,
    'sealed_at',        now(),
    'cobro_count',      cardinality(p_settlement_ids),
    'property_id',      p_property_id,
    'cobros_detail',    v_cobros_detail
  );

  update nodo_inmo.owner_settlements
     set status           = 'settled',
         settled_date     = v_today,
         breakdown        = v_breakdown,
         settlement_group = v_group
   where id = any(p_settlement_ids);

  update nodo_inmo.property_expenses
     set applied_settlement_id = v_anchor_id
   where id = any(
     select (elem->>'id')::uuid
     from jsonb_array_elements(v_deductions) elem
   );

  return v_breakdown;
end;
$$;

create or replace function nodo_inmo.annul_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id            uuid;
  v_settlement_status text;
  v_jwt_org           uuid;
begin
  v_jwt_org := ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid;

  select org_id
    into v_org_id
  from nodo_inmo.payments
  where id = p_payment_id;

  if v_org_id is null then
    raise exception 'Cuota no encontrada';
  end if;

  if v_org_id is distinct from v_jwt_org then
    raise exception 'Sin permiso para anular esta cuota';
  end if;

  select status
    into v_settlement_status
  from nodo_inmo.owner_settlements
  where payment_id = p_payment_id;

  if v_settlement_status = 'settled' then
    raise exception 'No se puede anular: la rendición al propietario ya fue finalizada';
  end if;

  delete from nodo_inmo.owner_settlements
  where payment_id = p_payment_id;

  delete from nodo_inmo.cash_movements
  where payment_id = p_payment_id;

  update nodo_inmo.payments
  set
    status                  = 'pending',
    paid_date               = null,
    paid_amount             = null,
    payment_method          = null,
    expenses_amount         = 0,
    collection_account_id   = null,
    updated_at              = now()
  where id = p_payment_id;
end;
$$;

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
  v_jwt_org := ((select auth.jwt()) -> 'app_metadata' -> 'memberships' -> 'inmo' ->> 'org_id')::uuid;

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
