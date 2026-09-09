-- Local-only bootstrap: admin user + org + pro tier (no service role key).
-- ponytail: SQL path for newer Supabase CLI keys; use bootstrap-admin.ts when JWT keys work.
do $$
declare
  v_user_id uuid := 'a1000000-0000-0000-0000-000000000001';
  v_org_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_email text := 'admin@nodoinmo.test';
  v_password text := 'local-dev-only';
begin
  if not exists (select 1 from auth.users where lower(email) = lower(v_email)) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(), now(), now()
    );
  else
    select id into v_user_id from auth.users where lower(email) = lower(v_email) limit 1;
  end if;

  if not exists (select 1 from shared.organizations where id = v_org_id) then
    insert into shared.organizations (id, name, tier, product)
    values (v_org_id, 'Agencia Local Pro', 'pro', 'inmo');
  else
    update shared.organizations set tier = 'pro', name = 'Agencia Local Pro' where id = v_org_id;
  end if;

  insert into shared.org_members (org_id, user_id, role)
  values (v_org_id, v_user_id, 'admin')
  on conflict (org_id, user_id) do update set role = 'admin';

  insert into shared.nodo_id (org_id, product)
  values (v_org_id, 'inmo')
  on conflict (org_id, product) do nothing;
end $$;
