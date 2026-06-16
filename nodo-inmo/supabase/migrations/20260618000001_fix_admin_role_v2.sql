-- Fix v2: force the nodo-inmo admin user's role to 'admin'.
-- First ensure the constraint allows 'admin', then update.

do $$
begin
  -- Drop the existing check constraint if it doesn't already include 'admin'
  -- (defensive: re-create it to ensure 'admin' is always valid)
  alter table shared.org_members
    drop constraint if exists org_members_role_check;

  alter table shared.org_members
    add constraint org_members_role_check
    check (role in ('admin', 'agent', 'owner', 'tenant', 'medico', 'paciente'));

  -- Now force the role update for this specific user + org
  update shared.org_members
  set    role = 'admin'
  where  user_id = '5e6a0f8d-a4a5-424c-85ab-5a94043b5e26'::uuid
    and  org_id  = '6473d7c6-4e75-486b-8841-92974c03e6a5'::uuid;

  raise notice 'Updated % row(s)', found::int;
end $$;
