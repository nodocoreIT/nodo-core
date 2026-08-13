-- Fix: la comisión de la inmobiliaria se calculaba sobre el bruto cobrado
-- (alquiler + expensas/otros), y debe calcularse solo sobre el alquiler
-- (payments.amount). El propietario sigue recibiendo el bruto menos la
-- comisión corregida (owner_share = gross - commission) — las expensas
-- pasan íntegras hasta que exista un mecanismo de retención por concepto.

create or replace function nodo_inmo.post_payment_to_caja()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_owner_id    uuid;
  v_rate        numeric;
  v_gross       numeric;
  v_commission  numeric;
  v_owner_share numeric;
  v_label       text;
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    v_label := to_char(new.period, 'MM/YYYY');
    v_gross := new.amount + coalesce(new.expenses_amount, 0);

    select p.owner_id,
           coalesce(
             case
               when k.rent_amount > 0 and k.commission_amount is not null
               then round(k.commission_amount / k.rent_amount * 100, 2)
               else null
             end,
             p.commission_rate,
             coalesce(ct.commission_rate, 0)
           )
      into v_owner_id, v_rate
    from nodo_inmo.contracts k
    join nodo_inmo.properties p on p.id = k.property_id
    left join nodo_inmo.contacts ct on ct.id = p.owner_id
    where k.id = new.contract_id;

    if v_owner_id is not null then
      v_commission  := round(new.amount * v_rate / 100, 2);
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
           coalesce(
             case
               when k.rent_amount > 0 and k.commission_amount is not null
               then round(k.commission_amount / k.rent_amount * 100, 2)
               else null
             end,
             p.commission_rate,
             coalesce(ct.commission_rate, 0)
           )
      into v_owner_id, v_rate
    from nodo_inmo.contracts k
    join nodo_inmo.properties p on p.id = k.property_id
    left join nodo_inmo.contacts ct on ct.id = p.owner_id
    where k.id = new.contract_id;

    if v_owner_id is not null then
      v_commission  := round(new.amount * v_rate / 100, 2);
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
  v_owner_id  uuid;
  v_rate      numeric;
  v_gross     numeric;
  v_commission numeric;
  v_owner_share numeric;
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
         coalesce(
           case
             when k.rent_amount > 0 and k.commission_amount is not null
             then round(k.commission_amount / k.rent_amount * 100, 2)
             else null
           end,
           p.commission_rate,
           coalesce(ct.commission_rate, 0)
         )
    into v_owner_id, v_rate
  from nodo_inmo.contracts k
  join nodo_inmo.properties p on p.id = k.property_id
  left join nodo_inmo.contacts ct on ct.id = p.owner_id
  where k.id = v_payment.contract_id;

  if v_owner_id is null then
    return;
  end if;

  v_commission  := round(v_payment.amount * v_rate / 100, 2);
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
