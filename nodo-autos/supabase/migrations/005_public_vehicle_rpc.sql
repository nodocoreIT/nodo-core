-- Public vehicle page: anon-safe read via RPC (no broad table access).
-- Producción usa schema public; local puede usar nodo_autos — aplicar el bloque que corresponda.

create or replace function public.get_public_vehicle(
  p_slug text,
  p_cliente_identificador text default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_cliente_id uuid;
  v_vehicle public.vehicles%rowtype;
  v_contacts jsonb;
begin
  if v_slug = '' then
    return null;
  end if;

  if p_cliente_identificador is not null and trim(p_cliente_identificador) <> '' then
    select id into v_cliente_id
    from public.clientes
    where lower(identificador) = lower(trim(p_cliente_identificador))
    limit 1;

    if v_cliente_id is null then
      return null;
    end if;

    select * into v_vehicle
    from public.vehicles
    where cliente_id = v_cliente_id
      and lower(public_slug) = v_slug
      and is_published = true
    limit 1;
  else
    select * into v_vehicle
    from public.vehicles
    where lower(public_slug) = v_slug
      and is_published = true
    limit 1;
  end if;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'name', u.name,
        'whatsapp_numero', u.whatsapp_numero,
        'profile_photo_url', u.profile_photo_url
      )
      order by u.created_at
    ),
    '[]'::jsonb
  )
  into v_contacts
  from public.users u
  where u.cliente_id = v_vehicle.cliente_id
    and coalesce(u.is_activo, true) = true
    and u.role = 'vendedor';

  return jsonb_build_object(
    'vehicle', jsonb_build_object(
      'id', v_vehicle.id,
      'brand', v_vehicle.brand,
      'model', v_vehicle.model,
      'version', v_vehicle.version,
      'year', v_vehicle.year,
      'kilometers', v_vehicle.kilometers,
      'fuel_type', v_vehicle.fuel_type,
      'transmission', v_vehicle.transmission,
      'condition', v_vehicle.condition,
      'currency', v_vehicle.currency,
      'list_price', v_vehicle.list_price,
      'cash_price', v_vehicle.cash_price,
      'show_price', v_vehicle.show_price,
      'description', v_vehicle.description,
      'features', coalesce(v_vehicle.features, '{}'::text[]),
      'photos', coalesce(v_vehicle.photos, '{}'::text[]),
      'public_slug', v_vehicle.public_slug,
      'social_title', v_vehicle.social_title,
      'social_description', v_vehicle.social_description
    ),
    'cliente', (
      select jsonb_build_object(
        'id', c.id,
        'nombre', c.nombre,
        'identificador', c.identificador,
        'logo_url', c.logo_url,
        'telefono', c.telefono,
        'whatsapp_numero', c.whatsapp_numero,
        'direccion', c.direccion,
        'sitio_web', c.sitio_web,
        'instagram_url', c.instagram_url,
        'facebook_url', c.facebook_url
      )
      from public.clientes c
      where c.id = v_vehicle.cliente_id
    ),
    'contacts', v_contacts
  );
end;
$$;

revoke all on function public.get_public_vehicle(text, text) from public;
grant execute on function public.get_public_vehicle(text, text) to anon, authenticated;
