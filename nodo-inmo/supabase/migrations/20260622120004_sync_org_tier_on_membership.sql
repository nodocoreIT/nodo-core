-- Keep shared.organizations.tier aligned when dashboard upgrades a user to Pro.
-- admin_ensure_inmo_membership previously skipped tier updates for existing orgs.

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

-- One-time backfill: users marked pro in auth metadata but org still starter.
update shared.organizations o
set tier = 'pro'
from shared.org_members om
join auth.users u on u.id = om.user_id
where om.org_id = o.id
  and o.tier = 'starter'
  and coalesce(u.raw_app_meta_data->>'plan', '') = 'pro';

-- Ensure Nodo ID rows exist for orgs now on Pro tier.
insert into shared.nodo_id (org_id, product)
select o.id, coalesce(nullif(o.product, ''), 'inmo')
from shared.organizations o
where o.tier = 'pro'
on conflict (org_id, product) do nothing;
