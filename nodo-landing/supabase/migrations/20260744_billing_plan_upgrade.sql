-- Plan upgrade UX: expose current plan code + catalog of active plans to end users.

create or replace function nodo_core.get_my_client_unit_subscription(p_unit_code text)
returns table (
  plan_code text,
  plan_label text,
  billing_amount numeric,
  billing_currency text,
  cycle_started_at timestamptz,
  next_due_at timestamptz,
  subscription_status text,
  client_unit_status text
)
language plpgsql
security definer
stable
set search_path = nodo_core, public, auth
as $$
declare
  v_email text;
  v_code text := trim(p_unit_code);
  v_client_unit_id uuid;
  v_plan_code text;
begin
  if v_code = '' then
    return;
  end if;

  select lower(email) into v_email
  from auth.users
  where id = auth.uid();

  if v_email is null then
    return;
  end if;

  select nea.client_unit_id into v_client_unit_id
  from nodo_core.node_email_access nea
  where lower(nea.email) = v_email
    and lower(nea.unit_code) = lower(v_code)
  limit 1;

  if v_client_unit_id is null then
    select cu.id into v_client_unit_id
    from nodo_core.clients c
    join nodo_core.client_units cu on cu.client_id = c.id
    where lower(c.email) = v_email
      and lower(cu.unit_code) = lower(v_code)
    limit 1;
  end if;

  if v_client_unit_id is null then
    select cu.id into v_client_unit_id
    from nodo_core.client_units cu
    where lower(cu.access_user) = v_email
      and lower(cu.unit_code) = lower(v_code)
    limit 1;
  end if;

  if v_client_unit_id is null then
    return;
  end if;

  select cu.plan into v_plan_code
  from nodo_core.client_units cu
  where cu.id = v_client_unit_id;

  return query
    select
      coalesce(v_plan_code, p.code),
      coalesce(p.label, v_plan_code),
      s.billing_amount,
      s.billing_currency,
      s.cycle_started_at,
      s.next_due_at,
      s.status,
      cu.status
    from nodo_core.client_units cu
    left join nodo_core.client_unit_subscriptions s on s.client_unit_id = cu.id
    left join nodo_core.planes p on p.id = s.plane_id
    where cu.id = v_client_unit_id;
exception
  when others then
    return;
end;
$$;

create or replace function nodo_core.get_unit_plans_for_subscriber(p_unit_code text)
returns table (
  code text,
  label text,
  price_monthly numeric,
  currency text,
  sort_order integer
)
language plpgsql
security definer
stable
set search_path = nodo_core, public, auth
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
    select p.code, p.label, p.price_monthly, p.currency, p.sort_order
    from nodo_core.planes p
    where lower(p.unit_code) = lower(trim(p_unit_code))
      and p.is_active = true
    order by p.sort_order, p.label;
exception
  when others then
    return;
end;
$$;

revoke all on function nodo_core.get_unit_plans_for_subscriber(text) from public;
revoke all on function nodo_core.get_unit_plans_for_subscriber(text) from anon;
grant execute on function nodo_core.get_unit_plans_for_subscriber(text) to authenticated;
