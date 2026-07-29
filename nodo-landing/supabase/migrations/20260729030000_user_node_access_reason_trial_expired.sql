-- Add 'trial_expired' as a new reason, for Nodo Finanzas' 7-day demo plan
-- (see 20260729020000_finanzas_demo_trial.sql). Every existing branch is
-- preserved byte-for-byte (verified against pg_get_functiondef on prod before
-- writing this migration) — this only inserts one new, self-contained,
-- early-return block for the Finanzas-demo case, checked independently of the
-- existing status-resolution chain because trial expiry is a computed
-- timestamp condition, not a stored status value those branches already
-- handle. Placed right after the banned check so a banned user still gets
-- 'banned' first; everything after this block is completely untouched.

create or replace function public.user_node_access_reason(p_unit_code text)
returns text
language plpgsql
security definer
stable
set search_path = nodo_core, shared, public, auth
as $$
declare
  v_email text;
  v_banned_until timestamptz;
  v_code text := trim(p_unit_code);
  v_status text;
  v_product text;
  v_trial_plan text;
  v_trial_ends_at timestamptz;
begin
  if v_code = '' then
    return 'invalid_credentials';
  end if;

  select lower(email), banned_until into v_email, v_banned_until
  from auth.users
  where id = auth.uid();

  if v_email is null then
    return 'invalid_credentials';
  end if;

  if v_banned_until is not null and v_banned_until > now() then
    return 'banned';
  end if;

  -- Finanzas 7-day demo: independent check, not part of the status chain below.
  if lower(v_code) in ('finanzas', 'nodo-finanzas') then
    select cu.plan, cu.trial_ends_at
    into v_trial_plan, v_trial_ends_at
    from nodo_core.client_units cu
    where lower(cu.access_user) = v_email
      and lower(cu.unit_code) = 'finanzas'
    limit 1;

    if v_trial_plan = 'demo' and v_trial_ends_at is not null and v_trial_ends_at < now() then
      return 'trial_expired';
    end if;
  end if;

  select nea.status into v_status
  from nodo_core.node_email_access nea
  where lower(nea.email) = v_email
    and lower(nea.unit_code) = lower(v_code)
  limit 1;

  if v_status is null then
    select cu.status into v_status
    from nodo_core.clients c
    join nodo_core.client_units cu on cu.client_id = c.id
    where lower(c.email) = v_email
      and lower(cu.unit_code) = lower(v_code)
    limit 1;
  end if;

  if v_status is null then
    select cu.status into v_status
    from nodo_core.client_units cu
    where lower(cu.access_user) = v_email
      and lower(cu.unit_code) = lower(v_code)
    limit 1;
  end if;

  if v_status is null then
    v_product := case
      when v_code in ('inmo', 'nodo-inmo') then 'inmo'
      when v_code in ('autos', 'nodo-autos') then 'autos'
      when v_code in ('finanzas', 'nodo-finanzas') then 'finanzas'
      else v_code
    end;

    if exists (
      select 1
      from shared.org_members om
      join shared.organizations o on o.id = om.org_id
      where om.user_id = auth.uid()
        and lower(coalesce(nullif(trim(o.product), ''), 'inmo')) = v_product
    ) then
      return 'ok';
    end if;

    return 'invalid_credentials';
  end if;

  if v_status = 'impago' then
    return 'payment_overdue';
  end if;

  if v_status in ('pausado', 'sin_acceso') then
    return 'invalid_credentials';
  end if;

  return 'ok';
exception
  when others then
    return 'ok';
end;
$$;

revoke all on function public.user_node_access_reason(text) from public;
revoke all on function public.user_node_access_reason(text) from anon;
grant execute on function public.user_node_access_reason(text) to authenticated;
