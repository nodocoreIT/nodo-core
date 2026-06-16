CREATE OR REPLACE FUNCTION nodo_inmo.status_changed_by_profile(p nodo_inmo.properties)
RETURNS jsonb AS $$
  SELECT jsonb_build_object('id', id, 'full_name', full_name)
  FROM shared.user_profiles
  WHERE id = p.status_changed_by;
$$ LANGUAGE sql STABLE;
