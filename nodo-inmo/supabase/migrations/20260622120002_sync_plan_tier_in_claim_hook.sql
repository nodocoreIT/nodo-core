-- Inject organizations.tier into JWT app_metadata.plan on every token mint.
-- Source of truth: shared.organizations.tier (starter | pro).

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
  v_tier     text;
  v_valid    boolean;
begin
  v_claims := event->'claims';
  v_cur_org := (v_claims->'app_metadata'->>'org_id')::uuid;

  if v_cur_org is not null then
    select exists(
      select 1 from shared.org_members
      where user_id = v_uid and org_id = v_cur_org
    ) into v_valid;

    if v_valid then
      select role into v_role
      from shared.org_members
      where user_id = v_uid and org_id = v_cur_org;

      v_org_id := v_cur_org;
    end if;
  end if;

  if v_org_id is null then
    select org_id, role into v_org_id, v_role
    from shared.org_members
    where user_id = v_uid
    order by created_at
    limit 1;
  end if;

  if v_org_id is not null then
    select tier into v_tier
    from shared.organizations
    where id = v_org_id;

    v_claims := jsonb_set(
      v_claims,
      '{app_metadata}',
      coalesce(v_claims->'app_metadata', '{}'::jsonb)
        || jsonb_build_object(
          'org_id', v_org_id,
          'role', v_role,
          'plan', coalesce(v_tier, v_claims->'app_metadata'->>'plan', 'starter')
        )
    );
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

grant execute on function shared.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function shared.custom_access_token_hook(jsonb) from authenticated, anon, public;
