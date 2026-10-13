-- Keep the configured agency % on the contract so IPC rent increases
-- do not drift the displayed/applied rate (e.g. 10% of 443200 = 44320
-- on 499355 looked like 8.88%).

alter table nodo_inmo.contracts
  add column if not exists commission_rate numeric(5,2);

comment on column nodo_inmo.contracts.commission_rate is
  'Copy of the configured agency %. Live rate is property then owner contact; this is a fallback only. Pesos in commission_amount are a snapshot.';

update nodo_inmo.contracts k
   set commission_rate = coalesce(p.commission_rate, ct.commission_rate)
  from nodo_inmo.properties p
  left join nodo_inmo.contacts ct on ct.id = p.owner_id
 where p.id = k.property_id
   and k.commission_rate is null;

create or replace function nodo_inmo.contract_commission_rate_pct(p_contract_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(
    p.commission_rate,
    ct.commission_rate,
    k.commission_rate,
    case
      when k.rent_amount > 0 and k.commission_amount is not null
      then round(k.commission_amount / k.rent_amount * 100, 2)
      else null
    end,
    0
  )
  from nodo_inmo.contracts k
  join nodo_inmo.properties p on p.id = k.property_id
  left join nodo_inmo.contacts ct on ct.id = p.owner_id
  where k.id = p_contract_id;
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
     or new.commission_rate is distinct from old.commission_rate
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
  after update of rent_amount, commission_amount, commission_rate, commission_on_gross
  on nodo_inmo.contracts
  for each row
  execute function nodo_inmo.on_contract_caja_sync();
