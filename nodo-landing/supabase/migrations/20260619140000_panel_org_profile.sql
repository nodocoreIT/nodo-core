-- Team membership helper (idempotent; may already exist from security baseline).
create or replace function nodo_core.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from nodo_core.profiles p
    where p.id = (select auth.uid())
  );
$$;

revoke execute on function nodo_core.is_team_member() from public, anon;
grant execute on function nodo_core.is_team_member() to authenticated;

-- Singleton org/branding row for the Nodo Core internal panel.
create table if not exists nodo_core.panel_org_profile (
  id text primary key default 'default' check (id = 'default'),
  legal_name text,
  address text,
  cuit text,
  phone text,
  email text,
  logo_path text,
  pdf_logo_path text,
  theme_settings jsonb,
  updated_at timestamptz not null default now()
);

insert into nodo_core.panel_org_profile (id)
values ('default')
on conflict (id) do nothing;

alter table nodo_core.panel_org_profile enable row level security;

create policy panel_org_profile_select on nodo_core.panel_org_profile
  for select to authenticated
  using ((select nodo_core.is_team_member()));

create policy panel_org_profile_insert on nodo_core.panel_org_profile
  for insert to authenticated
  with check ((select nodo_core.is_team_member()));

create policy panel_org_profile_update on nodo_core.panel_org_profile
  for update to authenticated
  using ((select nodo_core.is_team_member()))
  with check ((select nodo_core.is_team_member()));

create policy panel_org_profile_delete on nodo_core.panel_org_profile
  for delete to authenticated
  using ((select nodo_core.is_team_member()));
