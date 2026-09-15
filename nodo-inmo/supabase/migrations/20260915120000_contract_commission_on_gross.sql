-- Per-contract toggle: admin commission on rent only (default) or on gross
-- (rent + expenses_amount / expensas cobradas al inquilino).

alter table nodo_inmo.contracts
  add column if not exists commission_on_gross boolean not null default false;

comment on column nodo_inmo.contracts.commission_on_gross is
  'When true, agency commission is calculated on rent + expenses_amount; otherwise on rent only.';

create or replace function nodo_inmo.contract_commission_rate_pct(p_contract_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(
    case
      when k.rent_amount > 0 and k.commission_amount is not null
      then round(k.commission_amount / k.rent_amount * 100, 2)
      else null
    end,
    p.commission_rate,
    coalesce(ct.commission_rate, 0)
  )
  from nodo_inmo.contracts k
  join nodo_inmo.properties p on p.id = k.property_id
  left join nodo_inmo.contacts ct on ct.id = p.owner_id
  where k.id = p_contract_id;
$$;

create or replace function nodo_inmo.post_payment_to_caja()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_owner_id           uuid;
  v_rate               numeric;
  v_on_gross           boolean;
  v_gross              numeric;
  v_commission_base    numeric;
  v_commission         numeric;
  v_owner_share        numeric;
  v_label              text;
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    v_label := to_char(new.period, 'MM/YYYY');
    v_gross := new.amount + coalesce(new.expenses_amount, 0);

    select p.owner_id,
           nodo_inmo.contract_commission_rate_pct(k.id),
           k.commission_on_gross
      into v_owner_id, v_rate, v_on_gross
    from nodo_inmo.contracts k
    join nodo_inmo.properties p on p.id = k.property_id
    where k.id = new.contract_id;

    if v_owner_id is not null then
      v_commission_base := case when v_on_gross then v_gross else new.amount end;
      v_commission  := round(v_commission_base * v_rate / 100, 2);
      v_owner_share := v_gross - v_commission;

      if not exists (
        select 1 from nodo_inmo.cash_movements
        where payment_id = new.id and source = 'commission'
      ) then
        insert into nodo_inmo.cash_movements
          (org_id, type, amount, currency, date, concept, source, payment_id)
        values
          (new.org_id, 'income', v_commission, new.currency,
           coalesce(new.paid_date, current_date),
           'Comisión cobro ' || v_label, 'commission', new.id);
      end if;

      insert into nodo_inmo.owner_settlements
        (org_id, owner_id, payment_id, amount, currency, status)
      values
        (new.org_id, v_owner_id, new.id, v_owner_share, new.currency, 'pending')
      on conflict (payment_id) do nothing;
    else
      if not exists (
        select 1 from nodo_inmo.cash_movements where payment_id = new.id
      ) then
        insert into nodo_inmo.cash_movements
          (org_id, type, amount, currency, date, concept, source, payment_id)
        values
          (new.org_id, 'income', v_gross, new.currency,
           coalesce(new.paid_date, current_date),
           'Cobro alquiler ' || v_label, 'commission', new.id);
      end if;
    end if;

  elsif new.status = 'paid' and old.status = 'paid'
    and (
      new.amount is distinct from old.amount
      or coalesce(new.expenses_amount, 0) is distinct from coalesce(old.expenses_amount, 0)
    ) then
    v_gross := new.amount + coalesce(new.expenses_amount, 0);

    select p.owner_id,
           nodo_inmo.contract_commission_rate_pct(k.id),
           k.commission_on_gross
      into v_owner_id, v_rate, v_on_gross
    from nodo_inmo.contracts k
    join nodo_inmo.properties p on p.id = k.property_id
    where k.id = new.contract_id;

    if v_owner_id is not null then
      v_commission_base := case when v_on_gross then v_gross else new.amount end;
      v_commission  := round(v_commission_base * v_rate / 100, 2);
      v_owner_share := v_gross - v_commission;

      update nodo_inmo.cash_movements
      set amount = v_commission
      where payment_id = new.id and source = 'commission';

      update nodo_inmo.owner_settlements
      set amount = v_owner_share
      where payment_id = new.id
        and status = 'pending'
        and breakdown is null;
    else
      update nodo_inmo.cash_movements
      set amount = v_gross
      where payment_id = new.id and source = 'commission';
    end if;
  end if;

  return new;
end;
$$;

create or replace function nodo_inmo.recalc_payment_caja(p_payment_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_payment record;
  v_owner_id        uuid;
  v_rate            numeric;
  v_on_gross        boolean;
  v_gross           numeric;
  v_commission_base numeric;
  v_commission      numeric;
  v_owner_share     numeric;
begin
  select * into v_payment
  from nodo_inmo.payments
  where id = p_payment_id
    and status = 'paid';

  if not found then
    return;
  end if;

  v_gross := v_payment.amount + coalesce(v_payment.expenses_amount, 0);

  select p.owner_id,
         nodo_inmo.contract_commission_rate_pct(k.id),
         k.commission_on_gross
    into v_owner_id, v_rate, v_on_gross
  from nodo_inmo.contracts k
  join nodo_inmo.properties p on p.id = k.property_id
  where k.id = v_payment.contract_id;

  if v_owner_id is null then
    return;
  end if;

  v_commission_base := case when v_on_gross then v_gross else v_payment.amount end;
  v_commission  := round(v_commission_base * v_rate / 100, 2);
  v_owner_share := v_gross - v_commission;

  update nodo_inmo.cash_movements
     set amount = v_commission
   where payment_id = p_payment_id
     and source = 'commission';

  update nodo_inmo.owner_settlements
     set amount = v_owner_share
   where payment_id = p_payment_id
     and status = 'pending'
     and breakdown is null;
end;
$$;

create or replace function nodo_inmo.on_contract_caja_sync()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_payment_id uuid;
begin
  if new.rent_amount is distinct from old.rent_amount then
    update nodo_inmo.payments
       set amount = new.rent_amount,
           updated_at = now()
     where contract_id = new.id
       and status = 'pending';
  end if;

  if new.rent_amount is distinct from old.rent_amount
     or new.commission_amount is distinct from old.commission_amount
     or new.commission_on_gross is distinct from old.commission_on_gross then
    for v_payment_id in
      select pm.id
      from nodo_inmo.payments pm
      join nodo_inmo.owner_settlements os on os.payment_id = pm.id
      where pm.contract_id = new.id
        and pm.status = 'paid'
        and os.status = 'pending'
        and os.breakdown is null
    loop
      perform nodo_inmo.recalc_payment_caja(v_payment_id);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists contracts_caja_sync on nodo_inmo.contracts;

create trigger contracts_caja_sync
  after update of rent_amount, commission_amount, commission_on_gross on nodo_inmo.contracts
  for each row
  execute function nodo_inmo.on_contract_caja_sync();

-- Display rate in sealed breakdown: contractual %, not derived from commission/rent
-- when commission_on_gross (where derived rate would understate the agreed %).
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

  select coalesce(max(nodo_inmo.contract_commission_rate_pct(k.id)), 0)
    into v_rate
  from nodo_inmo.owner_settlements s
  join nodo_inmo.payments pm on pm.id = s.payment_id
  join nodo_inmo.contracts k on k.id = pm.contract_id
  where s.id = any(p_settlement_ids);

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
