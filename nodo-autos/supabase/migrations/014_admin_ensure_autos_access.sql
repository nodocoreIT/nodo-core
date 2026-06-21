-- Landing dashboard provisions Autos via service_role; nodo_autos is not an
-- exposed PostgREST schema, so all DB operations run inside a security-definer RPC.

create or replace function public.admin_ensure_autos_access(
  p_user_id uuid,
  p_email text,
  p_client_name text,
  p_identificador text,
  p_default_theme jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = nodo_autos, public
as $$
declare
  v_cliente_id uuid;
  v_existing_role text;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  -- 1. Check if user already exists in nodo_autos.users
  select u.cliente_id, u.role
  into v_cliente_id, v_existing_role
  from nodo_autos.users u
  where u.id = p_user_id;

  -- 2. If no user record, try to find cliente by email
  if v_cliente_id is null then
    select c.id into v_cliente_id
    from nodo_autos.clientes c
    where c.email_contacto = p_email
    limit 1;

    -- 3. If no cliente, create one
    if v_cliente_id is null then
      insert into nodo_autos.clientes (
        nombre, identificador, telefono, whatsapp_numero,
        email_contacto, theme_settings
      )
      values (
        coalesce(nullif(trim(p_client_name), ''), p_email),
        p_identificador,
        'pendiente',
        'pendiente',
        p_email,
        p_default_theme
      )
      returning id into v_cliente_id;
    else
      -- Seed theme on existing cliente if empty
      if p_default_theme is not null then
        update nodo_autos.clientes
        set theme_settings = p_default_theme
        where id = v_cliente_id
          and (theme_settings is null or theme_settings = '{}'::jsonb or theme_settings = 'null'::jsonb);
      end if;
    end if;

    -- 4. Upsert user record
    insert into nodo_autos.users (id, cliente_id, email, name, role)
    values (
      p_user_id,
      v_cliente_id,
      p_email,
      coalesce(nullif(trim(p_client_name), ''), p_email),
      'administrador'
    )
    on conflict (id) do update
      set cliente_id = excluded.cliente_id,
          email = excluded.email,
          name = excluded.name;
  else
    -- User exists — just seed theme if needed
    if p_default_theme is not null then
      update nodo_autos.clientes
      set theme_settings = p_default_theme
      where id = v_cliente_id
        and (theme_settings is null or theme_settings = '{}'::jsonb or theme_settings = 'null'::jsonb);
    end if;
  end if;

  return v_cliente_id;
end;
$$;

revoke all on function public.admin_ensure_autos_access(uuid, text, text, text, jsonb) from public;
grant execute on function public.admin_ensure_autos_access(uuid, text, text, text, jsonb) to service_role;
