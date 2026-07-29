-- Clinica doesn't participate in shared.org_members (it uses its own
-- patients/professionals tables), so get_my_orgs previously never surfaced
-- it — the NodoSwitcher couldn't show Clinica as a switch target even though
-- it's already rendered (with product="clinica") in nodo-clinica's own
-- medico layout. Union in synthetic rows for whichever Clinica role(s) the
-- current user has. org_id is the fixed shared clinic org id (matches
-- CLINIC_ORG_ID's default in nodo-clinica/src/lib/clinic/clinic-org.ts) —
-- it doesn't correspond to a shared.organizations row, it's just a stable
-- key for the switcher UI.
create or replace function public.get_my_orgs()
returns table(org_id uuid, org_name text, role text, product text)
language sql
security definer
stable
set search_path = ''
as $$
  select
    o.id        as org_id,
    o.name      as org_name,
    om.role     as role,
    o.product   as product
  from shared.org_members om
  join shared.organizations o on o.id = om.org_id
  where om.user_id = auth.uid()

  union all

  select
    '843524dc-0c3b-4340-bc8e-e3ae5aa00fd2'::uuid as org_id,
    'Nodo Clínica' as org_name,
    'medico' as role,
    'clinica' as product
  where exists (
    select 1 from nodo_clinica.professionals p where p.user_id = auth.uid()
  )

  union all

  select
    '843524dc-0c3b-4340-bc8e-e3ae5aa00fd2'::uuid as org_id,
    'Nodo Clínica' as org_name,
    'paciente' as role,
    'clinica' as product
  where exists (
    select 1 from nodo_clinica.patients p where p.profile_id = auth.uid()
  )

  order by org_name;
$$;

revoke execute on function public.get_my_orgs() from public;
grant execute on function public.get_my_orgs() to authenticated;
