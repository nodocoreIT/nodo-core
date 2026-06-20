-- Custom Access Token Hook — injects org_id + role into JWT app_metadata.
--
-- Called by GoTrue at token-mint time.
-- RLS policies read: auth.jwt() -> 'app_metadata' ->> 'org_id' / 'role'

-- ---------------------------------------------------------------------------
-- Custom Access Token Hook
-- ---------------------------------------------------------------------------
create or replace function shared.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb;
  v_org_id uuid;
  v_role   text;
begin
  select org_id, role into v_org_id, v_role
  from shared.org_members
  where user_id = (event->>'user_id')::uuid
  limit 1;

  v_claims := event->'claims';

  if v_org_id is not null then
    v_claims := jsonb_set(
      v_claims,
      '{app_metadata}',
      coalesce(v_claims->'app_metadata', '{}'::jsonb)
        || jsonb_build_object('org_id', v_org_id, 'role', v_role)
    );
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — Supabase hook permission model
-- https://supabase.com/docs/guides/auth/auth-hooks#hook-grants-and-permissions
-- ---------------------------------------------------------------------------

-- GoTrue runs as supabase_auth_admin; it needs usage on the schema and
-- execute on the hook function.
grant usage on schema shared to supabase_auth_admin;
grant execute on function shared.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- Revoke execute from the broad default-public grant and from standard roles.
-- The function is security definer (runs as postgres) so execute privilege
-- must be tightly controlled.
revoke execute on function shared.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- supabase_auth_admin needs SELECT on shared.org_members for the lookup inside
-- the security definer body. The function already runs as postgres (owner),
-- so this is belt-and-suspenders for environments where the ownership differs.
grant select on shared.org_members to supabase_auth_admin;
