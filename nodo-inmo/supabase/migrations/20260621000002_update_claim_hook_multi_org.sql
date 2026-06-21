-- Update custom_access_token_hook to support multi-org switching.
--
-- Before this migration the hook always did LIMIT 1 unconditionally, which
-- meant that switching org via switch-org Edge Function and refreshing the
-- session would reset the JWT back to the first org in the list.
--
-- This migration replaces the hook so that:
--   1. If raw_app_meta_data already has an org_id AND the user is still a
--      member of that org → keep that org_id and refresh the role from DB.
--   2. Otherwise → fall back to LIMIT 1 from org_members (first-login path
--      or stale org after removal).

create or replace function shared.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims   jsonb;
  v_uid      uuid := (event->>'user_id')::uuid;
  v_cur_org  uuid;
  v_org_id   uuid;
  v_role     text;
  v_valid    boolean;
begin
  v_claims := event->'claims';

  -- Check if app_metadata already has an org_id (set by switch-org or a
  -- previous hook run after the user accepted an invitation).
  v_cur_org := (v_claims->'app_metadata'->>'org_id')::uuid;

  if v_cur_org is not null then
    -- Validate that the user is still a member of the claimed org.
    select exists(
      select 1 from shared.org_members
      where user_id = v_uid and org_id = v_cur_org
    ) into v_valid;

    if v_valid then
      -- Keep current org, but always refresh role from DB so role changes
      -- are reflected on the next token mint.
      select role into v_role
      from shared.org_members
      where user_id = v_uid and org_id = v_cur_org;

      v_org_id := v_cur_org;
    end if;
  end if;

  -- Fallback: no valid current org → pick the user's OWN org (super_admin)
  -- first, then fall back to oldest membership.
  if v_org_id is null then
    select org_id, role into v_org_id, v_role
    from shared.org_members
    where user_id = v_uid
    order by (role = 'super_admin') desc, created_at
    limit 1;
  end if;

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

-- Grants are inherited from the previous migration; no changes needed.
-- Belt-and-suspenders: ensure supabase_auth_admin still has execute.
grant execute on function shared.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function shared.custom_access_token_hook(jsonb) from authenticated, anon, public;
