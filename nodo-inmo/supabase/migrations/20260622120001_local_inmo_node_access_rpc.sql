-- DEPRECATED: this migration replaced the full cross-nodo RPC with an Inmo-only stub.
-- Fixed by 20260623000002_restore_user_has_node_access.sql — do not copy this body elsewhere.

-- Inmo auth project: landing login calls public.user_has_node_access after sign-in.
-- When Inmo uses its own Supabase project (not landing's nodo_core tables), check org membership.

create or replace function public.user_has_node_access(p_unit_code text)
returns boolean
language plpgsql
security definer
stable
set search_path = shared, public, auth
as $$
declare
  v_code text := lower(trim(p_unit_code));
begin
  if v_code = '' then
    return false;
  end if;

  -- Inmo login (unit code "Inmo" from landing nodes registry)
  if v_code in ('inmo', 'nodo-inmo') then
    return exists (
      select 1
      from shared.org_members om
      where om.user_id = auth.uid()
    );
  end if;

  return false;
end;
$$;

revoke all on function public.user_has_node_access(text) from public;
grant execute on function public.user_has_node_access(text) to authenticated;
