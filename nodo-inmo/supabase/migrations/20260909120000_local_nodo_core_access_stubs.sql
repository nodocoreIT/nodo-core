-- ponytail: stubs for landing login guards (user_has_node_access / user_node_access_reason)
-- on inmo-only local Supabase. Empty tables; org_members path grants access.

create table if not exists nodo_core.client_units (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references nodo_core.clients (id) on delete cascade,
  unit_code text,
  status text,
  access_user text
);

create table if not exists nodo_core.node_email_access (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  unit_code text not null,
  client_id uuid references nodo_core.clients (id) on delete cascade,
  client_unit_id uuid references nodo_core.client_units (id) on delete cascade,
  status text not null default 'activo',
  created_at timestamptz not null default now(),
  unique (email, unit_code)
);

create or replace function public.user_node_access_reason(p_unit_code text)
returns text
language plpgsql
security definer
stable
set search_path = nodo_core, shared, public, auth
as $$
begin
  if public.user_has_node_access(p_unit_code) then
    return 'ok';
  end if;
  return 'invalid_credentials';
end;
$$;

revoke all on function public.user_node_access_reason(text) from public;
grant execute on function public.user_node_access_reason(text) to authenticated;
