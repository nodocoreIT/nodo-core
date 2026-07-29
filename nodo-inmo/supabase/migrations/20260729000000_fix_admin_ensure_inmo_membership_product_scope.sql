-- Fix: admin_ensure_inmo_membership looked up the user's existing org by
-- user_id ONLY, ignoring p_product. A user who already had an org for one
-- product (e.g. Inmo) got that SAME org reused for a different product's
-- provisioning call (e.g. Autos) instead of a distinct org — silently
-- merging role/org_id across nodes that must stay independent (admin in
-- Inmo does not imply admin in Autos, or any other node).
--
-- Rebuilt from the function's current live definition (confirmed via
-- pg_get_functiondef) — only the org lookup gains a product scope; the
-- tier-sync branch from 20260622120004 is preserved as-is.

create or replace function public.admin_ensure_inmo_membership(
  p_user_id uuid,
  p_client_name text,
  p_email text,
  p_plan text,
  p_product text default 'inmo'
)
returns uuid
language plpgsql
security definer
set search_path = shared, public
as $$
declare
  v_org_id uuid;
  v_tier text;
  v_name text;
  v_product text;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  v_tier := case when lower(coalesce(p_plan, '')) like '%pro%' then 'pro' else 'starter' end;
  v_name := coalesce(nullif(trim(p_client_name), ''), nullif(trim(p_email), ''), 'Organización');
  v_product := coalesce(nullif(trim(p_product), ''), 'inmo');

  -- Scoped by product: a membership in another node's org must never be
  -- reused (or have its tier/role touched) when provisioning this one.
  select om.org_id
  into v_org_id
  from shared.org_members om
  join shared.organizations o on o.id = om.org_id
  where om.user_id = p_user_id
    and o.product = v_product
  limit 1;

  if v_org_id is null then
    insert into shared.organizations (name, tier, product)
    values (v_name, v_tier, v_product)
    returning id into v_org_id;

    insert into shared.org_members (org_id, user_id, role)
    values (v_org_id, p_user_id, 'admin');
  elsif v_tier = 'pro' then
    update shared.organizations
    set tier = 'pro'
    where id = v_org_id
      and tier <> 'pro';
  end if;

  insert into shared.user_profiles (id, full_name)
  values (p_user_id, v_name)
  on conflict (id) do update
    set full_name = excluded.full_name;

  return v_org_id;
end;
$$;
