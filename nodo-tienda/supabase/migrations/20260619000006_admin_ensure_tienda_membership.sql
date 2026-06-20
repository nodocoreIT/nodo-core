-- Landing dashboard provisions Tienda via service_role; shared may not be an
-- exposed PostgREST schema, so membership setup runs in a public RPC
-- (security definer).

create or replace function public.admin_ensure_tienda_membership(
  p_user_id  uuid,
  p_client_name text,
  p_email    text,
  p_plan     text,
  p_product  text default 'tienda'
)
returns uuid
language plpgsql
security definer
set search_path = shared, public
as $$
declare
  v_org_id  uuid;
  v_tier    text;
  v_name    text;
  v_product text;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  v_tier    := case when lower(coalesce(p_plan, '')) like '%pro%' then 'pro' else 'starter' end;
  v_name    := coalesce(nullif(trim(p_client_name), ''), nullif(trim(p_email), ''), 'Organización');
  v_product := coalesce(nullif(trim(p_product), ''), 'tienda');

  select om.org_id
  into v_org_id
  from shared.org_members om
  where om.user_id = p_user_id
  limit 1;

  if v_org_id is null then
    insert into shared.organizations (name, tier, product)
    values (v_name, v_tier, v_product)
    returning id into v_org_id;

    insert into shared.org_members (org_id, user_id, role)
    values (v_org_id, p_user_id, 'admin');
  end if;

  insert into shared.user_profiles (id, full_name)
  values (p_user_id, v_name)
  on conflict (id) do update
    set full_name = excluded.full_name;

  return v_org_id;
end;
$$;

revoke all on function public.admin_ensure_tienda_membership(uuid, text, text, text, text) from public;
grant execute on function public.admin_ensure_tienda_membership(uuid, text, text, text, text) to service_role;
