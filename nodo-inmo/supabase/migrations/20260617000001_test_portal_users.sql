-- TEST DATA: portal test users setup
-- Creates org_members + contacts for inquilino@nodoinmo.com and propietario@nodoinmo.com
-- Auth users were created via Admin API:
--   inquilino:   d2f25bfc-af47-4917-82b6-37a9e7a2f802
--   propietario: 024d28c0-a3f0-46cc-97b5-02ab981a844d
--
-- This migration can be safely reverted / skipped in production.

do $$
declare
  v_org_id     uuid;
  v_tenant_uid uuid := 'd2f25bfc-af47-4917-82b6-37a9e7a2f802';
  v_owner_uid  uuid := '024d28c0-a3f0-46cc-97b5-02ab981a844d';
  v_tenant_contact_id uuid;
  v_owner_contact_id  uuid;
begin

  -- ── 1. Find the first nodo-inmo org (prefer pro tier) ─────────────────────
  -- product column defaults to 'inmo' (see create_shared_tables migration)
  select id into v_org_id
  from shared.organizations
  where product in ('inmo', 'nodo-inmo')
  order by
    case when tier = 'pro' then 0 else 1 end,
    created_at
  limit 1;

  -- Fallback: any org (in case product was provisioned without explicit value)
  if v_org_id is null then
    select id into v_org_id
    from shared.organizations
    order by created_at
    limit 1;
  end if;

  if v_org_id is null then
    -- Log what's actually in the table before failing
    raise notice 'Organizations in DB: %', (select json_agg(row_to_json(o)) from (select id, name, tier, product from shared.organizations limit 10) o);
    raise exception 'No organization found. Provision one first via the admin panel.';
  end if;

  raise notice 'Using org_id: %', v_org_id;

  -- ── 2. Insert org_members (tenant role) ───────────────────────────────────
  insert into shared.org_members (org_id, user_id, role)
  values (v_org_id, v_tenant_uid, 'tenant')
  on conflict (org_id, user_id) do update set role = 'tenant';

  -- ── 3. Insert org_members (owner role) ────────────────────────────────────
  insert into shared.org_members (org_id, user_id, role)
  values (v_org_id, v_owner_uid, 'owner')
  on conflict (org_id, user_id) do update set role = 'owner';

  -- ── 4. Create / upsert contact for inquilino ──────────────────────────────
  -- Check if a contact is already linked to this user
  select id into v_tenant_contact_id
  from nodo_inmo.contacts
  where portal_user_id = v_tenant_uid
  limit 1;

  if v_tenant_contact_id is null then
    -- Check if a tenant contact exists without portal_user_id to link
    select id into v_tenant_contact_id
    from nodo_inmo.contacts
    where org_id = v_org_id
      and 'tenant' = any(roles)
      and portal_user_id is null
    order by created_at
    limit 1;

    if v_tenant_contact_id is not null then
      -- Link existing contact
      update nodo_inmo.contacts
      set portal_user_id = v_tenant_uid
      where id = v_tenant_contact_id;
      raise notice 'Linked existing tenant contact % to inquilino user', v_tenant_contact_id;
    else
      -- Create new contact for the test tenant
      insert into nodo_inmo.contacts
        (org_id, name, email, roles, portal_user_id)
      values
        (v_org_id, 'Inquilino Test', 'inquilino@nodoinmo.com', array['tenant'], v_tenant_uid)
      returning id into v_tenant_contact_id;
      raise notice 'Created new tenant contact %', v_tenant_contact_id;
    end if;
  else
    raise notice 'Tenant contact already linked: %', v_tenant_contact_id;
  end if;

  -- ── 5. Create / upsert contact for propietario ────────────────────────────
  select id into v_owner_contact_id
  from nodo_inmo.contacts
  where portal_user_id = v_owner_uid
  limit 1;

  if v_owner_contact_id is null then
    -- Check if an owner contact exists without portal_user_id
    select id into v_owner_contact_id
    from nodo_inmo.contacts
    where org_id = v_org_id
      and 'owner' = any(roles)
      and portal_user_id is null
    order by created_at
    limit 1;

    if v_owner_contact_id is not null then
      update nodo_inmo.contacts
      set portal_user_id = v_owner_uid
      where id = v_owner_contact_id;
      raise notice 'Linked existing owner contact % to propietario user', v_owner_contact_id;
    else
      insert into nodo_inmo.contacts
        (org_id, name, email, roles, portal_user_id)
      values
        (v_org_id, 'Propietario Test', 'propietario@nodoinmo.com', array['owner'], v_owner_uid)
      returning id into v_owner_contact_id;
      raise notice 'Created new owner contact %', v_owner_contact_id;
    end if;
  else
    raise notice 'Owner contact already linked: %', v_owner_contact_id;
  end if;

  raise notice 'Setup complete. Tenant contact: %, Owner contact: %', v_tenant_contact_id, v_owner_contact_id;

end $$;
