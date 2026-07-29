-- Phase 2, Part A (additive only): the claim hook now ALSO computes
-- app_metadata.memberships — one slot per product — alongside the existing
-- flat org_id/role/plan fields, which are left completely untouched.
--
-- Rebuilt from the function's current live definition (confirmed via
-- pg_get_functiondef before writing this) — every existing line is
-- preserved byte-for-byte; the only addition is the new memberships block
-- right before the final `return jsonb_set(event, '{claims}', v_claims)`.
--
-- Why: app_metadata.org_id/role is a single flat value shared by every
-- product a user belongs to. Inmo self-heals it every login via this same
-- hook, but Autos/Finanzas/Ecommerce code that reads app_metadata.role
-- directly can end up reading a DIFFERENT product's role once more than one
-- product has provisioned the same user (see the Fase 1 fix in
-- provision.ts's hasForeignMembership). This gives every product its own
-- namespaced slot (`app_metadata.memberships.<product>.{org_id,role,plan}`)
-- to migrate to, without touching the ~135 existing Inmo RLS policies that
-- still read the flat field — that migration is a deliberately separate,
-- much riskier follow-up (Part B), not done here.
create or replace function shared.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
  declare
    v_claims   jsonb;
    v_uid      uuid := (event->>'user_id')::uuid;
    v_cur_org  uuid;
    v_org_id   uuid;
    v_role     text;
    v_tier     text;
    v_valid    boolean;
    v_memberships jsonb;
  begin
    v_claims := event->'claims';
    v_cur_org := (v_claims->'app_metadata'->>'org_id')::uuid;

    if v_cur_org is not null then
      select exists(
        select 1 from shared.org_members
        where user_id = v_uid and org_id = v_cur_org
      ) into v_valid;

      if v_valid then
        select "role" into v_role
        from shared.org_members
        where user_id = v_uid and org_id = v_cur_org;
        v_org_id := v_cur_org;
      end if;
    end if;

    if v_org_id is null then
      select org_id, "role" into v_org_id, v_role
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

    -- New, additive: one namespaced slot per product this user belongs to.
    select coalesce(
      jsonb_object_agg(
        coalesce(nullif(trim(o.product), ''), 'inmo'),
        jsonb_build_object('org_id', om.org_id, 'role', om.role, 'plan', o.tier)
      ),
      '{}'::jsonb
    )
    into v_memberships
    from shared.org_members om
    join shared.organizations o on o.id = om.org_id
    where om.user_id = v_uid;

    v_claims := jsonb_set(
      v_claims,
      '{app_metadata,memberships}',
      coalesce(v_memberships, '{}'::jsonb)
    );

    return jsonb_set(event, '{claims}', v_claims);

  exception
    when others then
      raise log 'custom_access_token_hook error uid=%: %', v_uid, sqlerrm;
      return event;
  end;
  $function$;
