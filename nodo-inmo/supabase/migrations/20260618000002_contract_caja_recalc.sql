-- Recalcular comisión y rendición pendiente cuando cambia el contrato.
-- También sincroniza el monto de cuotas pendientes al nuevo alquiler.

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

  v_commission  := round(v_gross * v_rate / 100, 2);
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
     or new.commission_amount is distinct from old.commission_amount then
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
  after update of rent_amount, commission_amount on nodo_inmo.contracts
  for each row
  execute function nodo_inmo.on_contract_caja_sync();
