ALTER TABLE nodo_inmo.org_profiles
  ADD COLUMN IF NOT EXISTS meta_settings jsonb DEFAULT NULL;
-- Stores: { instagram_account_id, facebook_page_id, access_token }
