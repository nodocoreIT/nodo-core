-- Public share link per property (WhatsApp / web flyer — no owner contact).

alter table nodo_inmo.properties
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists properties_share_token_idx
  on nodo_inmo.properties (share_token);

create or replace function public.get_public_property(p_share_token uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = nodo_inmo, public
as $$
declare
  v_row nodo_inmo.properties%rowtype;
  v_agency nodo_inmo.org_profiles%rowtype;
  v_paths text[];
begin
  select * into v_row
  from nodo_inmo.properties p
  where p.share_token = p_share_token
    and p.status in ('available', 'reserved');

  if not found then
    return null;
  end if;

  select * into v_agency
  from nodo_inmo.org_profiles op
  where op.org_id = v_row.org_id;

  if coalesce(array_length(v_row.photos, 1), 0) > 0 then
    v_paths := v_row.photos;
  elsif v_row.main_photo is not null then
    v_paths := array[v_row.main_photo];
  else
    v_paths := array[]::text[];
  end if;

  return jsonb_build_object(
    'address', v_row.address,
    'operation', v_row.operation,
    'property_type', v_row.property_type,
    'status', v_row.status,
    'sale_price', v_row.sale_price,
    'currency', v_row.currency,
    'total_sqm', v_row.total_sqm,
    'rooms', v_row.rooms,
    'bathrooms', v_row.bathrooms,
    'description', v_row.description,
    'localidad', v_row.localidad,
    'provincia', v_row.provincia,
    'has_pool', v_row.has_pool,
    'pets_allowed', v_row.pets_allowed,
    'has_garage', v_row.has_garage,
    'has_garden', v_row.has_garden,
    'has_laundry', v_row.has_laundry,
    'has_bbq', v_row.has_bbq,
    'has_elevator', v_row.has_elevator,
    'has_parking', v_row.has_parking,
    'photo_paths', to_jsonb(v_paths),
    'agency', jsonb_build_object(
      'legal_name', v_agency.legal_name,
      'phone', v_agency.phone,
      'email', v_agency.email
    )
  );
end;
$$;

revoke all on function public.get_public_property(uuid) from public;
grant execute on function public.get_public_property(uuid) to anon, authenticated, service_role;
