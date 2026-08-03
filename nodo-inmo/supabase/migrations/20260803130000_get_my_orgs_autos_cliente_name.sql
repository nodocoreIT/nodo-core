-- NodoSwitcher: show autos concesionaria name (legal_name / nombre), not
-- nodo_core.clients.name (registration label shared across all nodos).

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
      nullif(trim(ac.legal_name), ''),
      nullif(trim(ac.nombre), ''),
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
  left join nodo_autos.users au
    on au.id = om.user_id
    and lower(trim(coalesce(o.product, ''))) = 'autos'
  left join nodo_autos.clientes ac
    on ac.id = au.cliente_id
    and lower(trim(coalesce(o.product, ''))) = 'autos'
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

create or replace function nodo_autos.sync_organization_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(trim(new.legal_name), ''),
    nullif(trim(new.nombre), '')
  );
  if v_display_name is null then
    return new;
  end if;

  update shared.organizations o
  set name = v_display_name
  from shared.org_members om
  join nodo_autos.users au on au.id = om.user_id
  where au.cliente_id = new.id
    and o.id = om.org_id
    and lower(trim(coalesce(o.product, ''))) = 'autos'
    and trim(o.name) is distinct from v_display_name;

  return new;
end;
$$;

drop trigger if exists trg_sync_org_name_from_cliente on nodo_autos.clientes;

create trigger trg_sync_org_name_from_cliente
after insert or update of legal_name, nombre on nodo_autos.clientes
for each row
execute function nodo_autos.sync_organization_display_name();

update shared.organizations o
set name = coalesce(nullif(trim(c.legal_name), ''), nullif(trim(c.nombre), ''))
from shared.org_members om
join nodo_autos.users au on au.id = om.user_id
join nodo_autos.clientes c on c.id = au.cliente_id
where o.id = om.org_id
  and lower(trim(coalesce(o.product, ''))) = 'autos'
  and coalesce(nullif(trim(c.legal_name), ''), nullif(trim(c.nombre), '')) is not null
  and trim(o.name) is distinct from coalesce(nullif(trim(c.legal_name), ''), nullif(trim(c.nombre), ''));
