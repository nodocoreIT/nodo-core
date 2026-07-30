-- get_my_orgs' first branch reads shared.org_members raw, assuming Clinica
-- never has rows there (see 20260729040000's comment). That assumption is
-- now false: onboarding/medico/route.ts inserts a shared.org_members row
-- (role="admin", a placeholder Clinica itself never reads for authorization)
-- so médicos can be found by other lookups. Since Clinica already has its
-- own dedicated médico/paciente branches below with the correct semantic
-- roles, that generic org_members row leaked in as a confusing THIRD
-- "Nodo Clínica · Admin" entry in the NodoSwitcher. Exclude it here.
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
    and o.product is distinct from 'clinica'

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
