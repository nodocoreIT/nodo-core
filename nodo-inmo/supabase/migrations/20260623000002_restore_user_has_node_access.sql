-- Restore cross-nodo login guard after 20260622120001 accidentally replaced it with
-- an Inmo-only stub (Finanzas/Autos always returned false → immediate sign-out on login).

create or replace function public.user_has_node_access(p_unit_code text)
returns boolean
language plpgsql
security definer
stable
set search_path = nodo_core, shared, public, auth
as $$
declare
  v_email text;
  v_code text := lower(trim(p_unit_code));
  v_product text;
begin
  if v_code = '' then
    return false;
  end if;

  select lower(email) into v_email
  from auth.users
  where id = auth.uid();

  if v_email is null then
    return false;
  end if;

  if exists (
    select 1
    from nodo_core.node_email_access nea
    where lower(nea.email) = v_email
      and lower(nea.unit_code) = v_code
      and nea.status is distinct from 'pausado'
  ) then
    return true;
  end if;

  if exists (
    select 1
    from nodo_core.clients c
    join nodo_core.client_units cu on cu.client_id = c.id
    where lower(c.email) = v_email
      and lower(cu.unit_code) = v_code
      and cu.status is distinct from 'pausado'
  ) then
    return true;
  end if;

  if exists (
    select 1
    from nodo_core.client_units cu
    where lower(cu.access_user) = v_email
      and lower(cu.unit_code) = v_code
      and cu.status is distinct from 'pausado'
  ) then
    return true;
  end if;

  v_product := case
    when v_code in ('inmo', 'nodo-inmo') then 'inmo'
    when v_code in ('autos', 'nodo-autos') then 'autos'
    when v_code in ('finanzas', 'nodo-finanzas') then 'finanzas'
    else v_code
  end;

  return exists (
    select 1
    from shared.org_members om
    join shared.organizations o on o.id = om.org_id
    where om.user_id = auth.uid()
      and lower(coalesce(nullif(trim(o.product), ''), 'inmo')) = v_product
  );
end;
$$;

revoke all on function public.user_has_node_access(text) from public;
grant execute on function public.user_has_node_access(text) to authenticated;
