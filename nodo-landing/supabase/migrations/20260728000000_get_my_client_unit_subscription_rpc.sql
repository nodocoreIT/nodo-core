-- Exposes a client_unit's OWN subscription/billing info to its end user (the
-- business owner logged into their nodo — e.g. nodo-finanzas), for the
-- "Configuración > Suscripción" screen (platform-subscription-billing, Phase 6).
--
-- nodo_core.client_unit_subscriptions and nodo_core.planes are gated by
-- nodo_core.is_team_member() only — correct for NODO's own internal panel,
-- but that means a client_unit's own user (not a team member) cannot read
-- their own billing state directly via PostgREST. This SECURITY DEFINER RPC
-- is the one sanctioned way around that: it returns rows ONLY for the
-- client_unit matching the calling user, never anyone else's.
--
-- Mirrors the exact same auth-user -> client_unit lookup chain as
-- public.user_node_access_reason (node_email_access, then clients+client_units,
-- then client_units.access_user) so "which client_unit is this user" stays
-- consistent with the one already-proven, live access-check logic — not a
-- second, potentially-diverging definition of "my own unit".
create or replace function nodo_core.get_my_client_unit_subscription(p_unit_code text)
returns table (
  plan_label text,
  billing_amount numeric,
  billing_currency text,
  cycle_started_at timestamptz,
  next_due_at timestamptz,
  subscription_status text,
  client_unit_status text
)
language plpgsql
security definer
stable
set search_path = nodo_core, public, auth
as $$
declare
  v_email text;
  v_code text := trim(p_unit_code);
  v_client_unit_id uuid;
begin
  if v_code = '' then
    return;
  end if;

  select lower(email) into v_email
  from auth.users
  where id = auth.uid();

  if v_email is null then
    return;
  end if;

  select nea.client_unit_id into v_client_unit_id
  from nodo_core.node_email_access nea
  where lower(nea.email) = v_email
    and lower(nea.unit_code) = lower(v_code)
  limit 1;

  if v_client_unit_id is null then
    select cu.id into v_client_unit_id
    from nodo_core.clients c
    join nodo_core.client_units cu on cu.client_id = c.id
    where lower(c.email) = v_email
      and lower(cu.unit_code) = lower(v_code)
    limit 1;
  end if;

  if v_client_unit_id is null then
    select cu.id into v_client_unit_id
    from nodo_core.client_units cu
    where lower(cu.access_user) = v_email
      and lower(cu.unit_code) = lower(v_code)
    limit 1;
  end if;

  if v_client_unit_id is null then
    return;
  end if;

  return query
    select
      p.label,
      s.billing_amount,
      s.billing_currency,
      s.cycle_started_at,
      s.next_due_at,
      s.status,
      cu.status
    from nodo_core.client_unit_subscriptions s
    join nodo_core.client_units cu on cu.id = s.client_unit_id
    join nodo_core.planes p on p.id = s.plane_id
    where s.client_unit_id = v_client_unit_id;
exception
  when others then
    return;
end;
$$;

-- Same PostgREST anon-grant gap as public.user_node_access_reason — schema-level
-- default privileges grant EXECUTE to anon/authenticated regardless of `revoke
-- ... from public`. Revoke from anon explicitly; only authenticated users (who
-- have a real auth.uid()) can ever get a non-empty result anyway.
revoke all on function nodo_core.get_my_client_unit_subscription(text) from public;
revoke all on function nodo_core.get_my_client_unit_subscription(text) from anon;
grant execute on function nodo_core.get_my_client_unit_subscription(text) to authenticated;
