-- Additive companion RPC for public.user_has_node_access (platform-subscription-billing,
-- Phase 2). Surfaces a machine-readable reason alongside the existing boolean access
-- check, so nodos can distinguish "payment overdue" (still allowed in) from real denial.
--
-- IMPORTANT: public.user_has_node_access DDL is left byte-for-byte unchanged by this
-- migration. That function is the drift-scarred, all-nodo-login critical path (a
-- nodo-inmo migration once overwrote it and broke Autos/Finanzas login — see
-- 20260619180000_user_has_node_access_access_user.sql and the RPC-drift CI guard added
-- in a later phase of this change). It remains the sole access decision; this RPC only
-- adds context, never gates anything on its own.
--
-- Mirrors the same lookup paths as the LIVE public.user_has_node_access (checked via
-- pg_get_functiondef against production, since it has drifted from the migration file
-- that originally created it — a 4th org_members/organizations-by-product fallback for
-- internal team members exists in prod but isn't captured in any tracked migration).
-- Path order: node_email_access, then clients+client_units, then client_units.access_user
-- (status-bearing — mapped to a reason below), then shared.org_members/organizations by
-- product (team-membership access, no status column — reaching this path means 'ok'):
--   'impago'            -> 'payment_overdue' (access stays allowed — see spec node-access,
--                           "impago unit is allowed through the access check")
--   'pausado'/'sin_acceso' -> 'invalid_credentials' (informational only; the boolean RPC
--                           already denies these identically to before this change)
--   no matching row     -> 'invalid_credentials'
--   anything else (activo, pending_*, onboarding, ...) -> 'ok'
--
-- 'banned' is checked first, directly against auth.users.banned_until, to catch a user
-- banned mid-session (their JWT can remain valid until natural expiry even after a ban
-- is applied) — a case the sign-in-time error-message check in verify-node-access.ts's
-- mapAuthLoginError() can't catch, since sign-in already succeeded earlier.
--
-- Fail-open: any unexpected error resolves to 'ok' (see exception handler) — reason must
-- never be able to lock a user out; user_has_node_access remains solely responsible for
-- that decision.

create or replace function public.user_node_access_reason(p_unit_code text)
returns text
language plpgsql
security definer
stable
set search_path = nodo_core, shared, public, auth
as $$
declare
  v_email text;
  v_banned_until timestamptz;
  v_code text := trim(p_unit_code);
  v_status text;
  v_product text;
begin
  if v_code = '' then
    return 'invalid_credentials';
  end if;

  select lower(email), banned_until into v_email, v_banned_until
  from auth.users
  where id = auth.uid();

  if v_email is null then
    return 'invalid_credentials';
  end if;

  if v_banned_until is not null and v_banned_until > now() then
    return 'banned';
  end if;

  select nea.status into v_status
  from nodo_core.node_email_access nea
  where lower(nea.email) = v_email
    and lower(nea.unit_code) = lower(v_code)
  limit 1;

  if v_status is null then
    select cu.status into v_status
    from nodo_core.clients c
    join nodo_core.client_units cu on cu.client_id = c.id
    where lower(c.email) = v_email
      and lower(cu.unit_code) = lower(v_code)
    limit 1;
  end if;

  if v_status is null then
    select cu.status into v_status
    from nodo_core.client_units cu
    where lower(cu.access_user) = v_email
      and lower(cu.unit_code) = lower(v_code)
    limit 1;
  end if;

  if v_status is null then
    -- 4th path: internal team membership via shared.org_members/organizations,
    -- matched by product (mirrors user_has_node_access's live production logic).
    -- No status column applies here — reaching this path means access is granted.
    v_product := case
      when v_code in ('inmo', 'nodo-inmo') then 'inmo'
      when v_code in ('autos', 'nodo-autos') then 'autos'
      when v_code in ('finanzas', 'nodo-finanzas') then 'finanzas'
      else v_code
    end;

    if exists (
      select 1
      from shared.org_members om
      join shared.organizations o on o.id = om.org_id
      where om.user_id = auth.uid()
        and lower(coalesce(nullif(trim(o.product), ''), 'inmo')) = v_product
    ) then
      return 'ok';
    end if;

    return 'invalid_credentials';
  end if;

  if v_status = 'impago' then
    return 'payment_overdue';
  end if;

  if v_status in ('pausado', 'sin_acceso') then
    return 'invalid_credentials';
  end if;

  return 'ok';
exception
  when others then
    return 'ok';
end;
$$;

-- Supabase grants EXECUTE on new public-schema functions to anon/authenticated
-- directly (a schema-level default privilege), separate from the PUBLIC
-- pseudo-role — `revoke ... from public` alone does not strip it (confirmed via
-- has_function_privilege; the same gap exists on the pre-existing
-- user_has_node_access, left untouched per this migration's constraints). Revoke
-- from anon explicitly here since it's free to do for a brand-new function: an
-- anon caller only ever resolves auth.uid() to null (no user-data disclosure
-- either way), but there's no reason to leave a SECURITY DEFINER function
-- reachable by unauthenticated callers when authenticated-only is trivial to enforce.
revoke all on function public.user_node_access_reason(text) from public;
revoke all on function public.user_node_access_reason(text) from anon;
grant execute on function public.user_node_access_reason(text) to authenticated;
