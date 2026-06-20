-- public.get_my_orgs() — bypasses RLS, returns all orgs the current user belongs to
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
  order by o.name;
$$;

revoke execute on function public.get_my_orgs() from public;
grant execute on function public.get_my_orgs() to authenticated;
