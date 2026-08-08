-- Root cause of the recurring Finanzas login-bounce: shared.custom_access_token_hook
-- recomputes app_metadata.role from shared.org_members on EVERY token mint, for
-- ANY user who has an org_members row in ANY product — permanently overriding
-- whatever role a one-off data fix sets on raw_app_meta_data. Finanzas has no
-- org_members table of its own, so AuthProvider's getNodeIdentity() always came
-- back null for it and fell back to this hook-clobbered flat claim.
--
-- Fix: give user_node_role('Finanzas') a real, node-scoped answer sourced from
-- nodo_core.client_units (the data that already correctly grants/denies Finanzas
-- access via user_has_node_access), instead of leaving Finanzas dependent on a
-- claim field designed for a different product's org membership. Platform
-- super_admins (any product) are left alone — they already get a valid Finanzas
-- role via the existing claims fallback, no need to touch that path.

create or replace function public.user_node_role(p_unit_code text)
returns table(org_id uuid, role text, plan text)
language plpgsql
stable security definer
set search_path to 'nodo_core', 'shared', 'public', 'auth'
as $function$
declare
  v_product text;
  v_email text;
  v_has_org_membership boolean;
  v_is_platform_super_admin boolean;
begin
  v_product := case
    when lower(trim(p_unit_code)) in ('inmo', 'nodo-inmo') then 'inmo'
    when lower(trim(p_unit_code)) in ('autos', 'nodo-autos') then 'autos'
    when lower(trim(p_unit_code)) in ('finanzas', 'nodo-finanzas') then 'finanzas'
    else lower(trim(p_unit_code))
  end;

  select exists (
    select 1
    from shared.org_members om
    join shared.organizations o on o.id = om.org_id
    where om.user_id = auth.uid()
      and lower(coalesce(nullif(trim(o.product), ''), 'inmo')) = v_product
  ) into v_has_org_membership;

  if v_has_org_membership then
    return query
    select om.org_id, om.role, coalesce(o.tier, 'starter')
    from shared.org_members om
    join shared.organizations o on o.id = om.org_id
    where om.user_id = auth.uid()
      and lower(coalesce(nullif(trim(o.product), ''), 'inmo')) = v_product
    limit 1;
    return;
  end if;

  if v_product = 'finanzas' then
    -- Platform super_admins (any product's org) already get a valid Finanzas
    -- role ("super_admin") via the hook-clobbered claim fallback — leave
    -- that path alone. Everyone else (regular per-product org owners like a
    -- small-business "admin" of their own Inmo agency) gets resolved from
    -- their own Finanzas client_units row instead of an unrelated org role.
    select exists (
      select 1 from shared.org_members om
      where om.user_id = auth.uid() and om.role = 'super_admin'
    ) into v_is_platform_super_admin;

    if v_is_platform_super_admin then
      return;
    end if;

    select lower(email) into v_email from auth.users where id = auth.uid();

    return query
    select null::uuid, 'user'::text, coalesce(cu.plan, 'starter')
    from nodo_core.client_units cu
    where lower(cu.access_user) = v_email
      and lower(cu.unit_code) = 'finanzas'
      and coalesce(cu.status, '') not in ('pausado', 'sin_acceso')
    limit 1;
  end if;
exception
  when others then
    return;
end;
$function$;
