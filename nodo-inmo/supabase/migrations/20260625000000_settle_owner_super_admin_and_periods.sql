-- Fix: allow super_admin role (not just admin) to call settle_owner.
-- Enhancement: include per-payment period detail in the sealed breakdown JSONB.

create or replace function nodo_inmo.settle_owner(
  p_owner_id        uuid,
  p_property_id     uuid,
  p_currency        text,
  p_settlement_ids  uuid[]
) returns jsonb
  language plpgsql
  security invoker
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
begin
  v_org_id := ((select auth.jwt()) -> 'app_metadata' ->> 'org_id')::uuid;
  if (select auth.jwt()) -> 'app_metadata' ->> 'role' not in ('admin', 'super_admin') then
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

  v_rate := case when v_gross > 0
    then round(v_commission / v_gross * 100, 2)
    else 0
  end;

  -- Build per-payment period detail for the breakdown
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

  v_net := v_net_owner - v_deduction_sum;

  v_breakdown := jsonb_build_object(
    'version',          2,
    'currency',         p_currency,
    'gross',            v_gross,
    'rent_gross',       v_rent_gross,
    'expenses_gross',   v_expenses_gross,
    'commission_rate',  v_rate,
    'commission',       v_commission,
    'owner_share',      v_net_owner,
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
