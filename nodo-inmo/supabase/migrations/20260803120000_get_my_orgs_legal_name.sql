-- NodoSwitcher: show razón social (legal_name / client name / person name),
-- not the registration full name stored in shared.organizations.name.

create or replace function public.get_my_orgs()
returns table(org_id uuid, org_name text, role text, product text)
language sql
security definer
stable
set search_path = ''
as $$
  select
    o.id as org_id,
    coalesce(
      nullif(trim(op.legal_name), ''),
      nullif(trim(c.name), ''),
      nullif(trim(o.name), ''),
      'Organización'
    ) as org_name,
    om.role as role,
    o.product as product
  from shared.org_members om
  join shared.organizations o on o.id = om.org_id
  left join nodo_inmo.org_profiles op
    on op.org_id = o.id
    and lower(trim(coalesce(o.product, ''))) = 'inmo'
  left join auth.users u on u.id = auth.uid()
  left join nodo_core.clients c on lower(trim(c.email)) = lower(trim(u.email))
  where om.user_id = auth.uid()
    and o.product is distinct from 'clinica'

  union all

  select
    '843524dc-0c3b-4340-bc8e-e3ae5aa00fd2'::uuid as org_id,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(c.name), ''),
      'Consultorio'
    ) as org_name,
    'medico' as role,
    'clinica' as product
  from nodo_clinica.professionals p
  left join auth.users u on u.id = p.user_id
  left join nodo_core.clients c on lower(trim(c.email)) = lower(trim(u.email))
  where p.user_id = auth.uid()

  union all

  select
    '843524dc-0c3b-4340-bc8e-e3ae5aa00fd2'::uuid as org_id,
    coalesce(
      nullif(trim(pt.full_name), ''),
      nullif(trim(c.name), ''),
      'Mi cuenta'
    ) as org_name,
    'paciente' as role,
    'clinica' as product
  from nodo_clinica.patients pt
  left join auth.users u on u.id = pt.profile_id
  left join nodo_core.clients c on lower(trim(c.email)) = lower(trim(u.email))
  where pt.profile_id = auth.uid()

  order by org_name;
$$;

revoke execute on function public.get_my_orgs() from public;
grant execute on function public.get_my_orgs() to authenticated;

-- Keep shared.organizations.name aligned when admins update razón social.
create or replace function nodo_inmo.sync_organization_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.legal_name is not null and trim(new.legal_name) <> '' then
    update shared.organizations
    set name = trim(new.legal_name)
    where id = new.org_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_org_name_from_legal_name on nodo_inmo.org_profiles;

create trigger trg_sync_org_name_from_legal_name
after insert or update of legal_name on nodo_inmo.org_profiles
for each row
execute function nodo_inmo.sync_organization_display_name();

-- Backfill existing inmo orgs that already have legal_name set.
update shared.organizations o
set name = trim(op.legal_name)
from nodo_inmo.org_profiles op
where op.org_id = o.id
  and lower(trim(coalesce(o.product, ''))) = 'inmo'
  and nullif(trim(op.legal_name), '') is not null
  and trim(o.name) is distinct from trim(op.legal_name);
