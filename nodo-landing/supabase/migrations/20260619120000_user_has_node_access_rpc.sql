-- Cross-node login guard: authenticated users may only access nodos they registered for.

create or replace function public.user_has_node_access(p_unit_code text)
returns boolean
language plpgsql
security definer
stable
set search_path = nodo_core, public, auth
as $$
declare
  v_email text;
  v_code text := trim(p_unit_code);
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
      and nea.unit_code = v_code
      and nea.status is distinct from 'pausado'
  ) then
    return true;
  end if;

  return exists (
    select 1
    from nodo_core.clients c
    join nodo_core.client_units cu on cu.client_id = c.id
    where lower(c.email) = v_email
      and cu.unit_code = v_code
      and cu.status is distinct from 'pausado'
  );
end;
$$;

revoke all on function public.user_has_node_access(text) from public;
grant execute on function public.user_has_node_access(text) to authenticated;
