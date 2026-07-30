-- Deny paused / sin_acceso client units BEFORE the shared.org_members fallback.
--
-- Bug: pausing a client_unit correctly sets client_units.status + node_email_access.status
-- to 'pausado', and the first three grant paths correctly skip those rows. But provisioned
-- clients also have shared.org_members (admin_ensure_*_membership), and the 4th path
-- granted access with no status check — so pause was a no-op for paying clients.
--
-- Fix: explicit deny-first when the email/access_user has a matching unit row in
-- ('pausado', 'sin_acceso'). Team-only org_members users (no client_unit / NEA row) still
-- pass through path 4. Impago stays allowed (payment lockout is handled elsewhere).
--
-- Owner: nodo-landing only (see .github/workflows/rpc-drift-guard.yml).

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

  -- Deny-first: explicit pause / sin_acceso must win over org_members.
  if exists (
    select 1
    from nodo_core.node_email_access nea
    where lower(nea.email) = v_email
      and lower(nea.unit_code) = v_code
      and nea.status in ('pausado', 'sin_acceso')
  ) then
    return false;
  end if;

  if exists (
    select 1
    from nodo_core.clients c
    join nodo_core.client_units cu on cu.client_id = c.id
    where lower(c.email) = v_email
      and lower(cu.unit_code) = v_code
      and cu.status in ('pausado', 'sin_acceso')
  ) then
    return false;
  end if;

  if exists (
    select 1
    from nodo_core.client_units cu
    where lower(cu.access_user) = v_email
      and lower(cu.unit_code) = v_code
      and cu.status in ('pausado', 'sin_acceso')
  ) then
    return false;
  end if;

  -- Grant paths (status-bearing rows exclude pausado + sin_acceso; impago still allowed).
  if exists (
    select 1
    from nodo_core.node_email_access nea
    where lower(nea.email) = v_email
      and lower(nea.unit_code) = v_code
      and coalesce(nea.status, '') not in ('pausado', 'sin_acceso')
  ) then
    return true;
  end if;

  if exists (
    select 1
    from nodo_core.clients c
    join nodo_core.client_units cu on cu.client_id = c.id
    where lower(c.email) = v_email
      and lower(cu.unit_code) = v_code
      and coalesce(cu.status, '') not in ('pausado', 'sin_acceso')
  ) then
    return true;
  end if;

  if exists (
    select 1
    from nodo_core.client_units cu
    where lower(cu.access_user) = v_email
      and lower(cu.unit_code) = v_code
      and coalesce(cu.status, '') not in ('pausado', 'sin_acceso')
  ) then
    return true;
  end if;

  -- Internal team membership (no client_unit row) — only reached when no deny matched.
  v_product := case
    when v_code in ('inmo', 'nodo-inmo') then 'inmo'
    when v_code in ('autos', 'nodo-autos') then 'autos'
    when v_code in ('finanzas', 'nodo-finanzas') then 'finanzas'
    when v_code in ('clinica', 'clínica', 'nodo-clinica') then 'clinica'
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
revoke all on function public.user_has_node_access(text) from anon;
grant execute on function public.user_has_node_access(text) to authenticated;
