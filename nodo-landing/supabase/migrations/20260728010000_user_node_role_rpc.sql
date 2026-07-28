-- Additive companion RPC for public.user_has_node_access. Resolves the caller's
-- role/org/plan SCOPED TO THIS SPECIFIC NODE, instead of the shared-components
-- AuthProvider trusting the raw JWT app_metadata.role/org_id/plan claims — which
-- are a single GLOBAL value per auth user (stamped by whichever nodo the user
-- last onboarded/synced into, e.g. nodo-clinica's syncClinicaAuthClaims), not
-- scoped per nodo. An account with legitimate memberships across multiple
-- nodos (increasingly common as platform-subscription-billing rolls out) would
-- otherwise have ITS OWN role from nodo A silently override the allowedRoles
-- gate in nodo B, incorrectly locking them out with no visible error (see the
-- nodo-finanzas login bug this migration fixes).
--
-- Mirrors user_has_node_access's/user_node_access_reason's team-membership path
-- (shared.org_members/organizations matched by product) — the ONLY path that can
-- carry a meaningful role/org_id/plan triad. Client_units/node_email_access-only
-- customers (no org_members row for this nodo) have no such notion; this RPC
-- returns an empty set for them, and AuthProvider falls back to the existing
-- JWT-decoded values in that case (no regression for pure client access).
--
-- Fail-open by design: an empty result is never itself a denial. This RPC only
-- supplies context for role/org display and the allowedRoles gate; access itself
-- remains solely decided by user_has_node_access/enforceNodeAccess.

create or replace function public.user_node_role(p_unit_code text)
returns table (org_id uuid, role text, plan text)
language plpgsql
stable
security definer
set search_path = nodo_core, shared, public, auth
as $$
declare
  v_product text;
begin
  v_product := case
    when lower(trim(p_unit_code)) in ('inmo', 'nodo-inmo') then 'inmo'
    when lower(trim(p_unit_code)) in ('autos', 'nodo-autos') then 'autos'
    when lower(trim(p_unit_code)) in ('finanzas', 'nodo-finanzas') then 'finanzas'
    else lower(trim(p_unit_code))
  end;

  return query
  select om.org_id, om.role, coalesce(o.tier, 'starter')
  from shared.org_members om
  join shared.organizations o on o.id = om.org_id
  where om.user_id = auth.uid()
    and lower(coalesce(nullif(trim(o.product), ''), 'inmo')) = v_product
  limit 1;
exception
  when others then
    return;
end;
$$;

-- See user_node_access_reason_rpc.sql — Supabase grants EXECUTE on new
-- public-schema functions to anon/authenticated directly regardless of the
-- PUBLIC pseudo-role revoke; strip anon explicitly.
revoke all on function public.user_node_role(text) from public;
revoke all on function public.user_node_role(text) from anon;
grant execute on function public.user_node_role(text) to authenticated;
