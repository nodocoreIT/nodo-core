ALTER TABLE nodo_inmo.properties
  ADD COLUMN IF NOT EXISTS instagram_post_id text,
  ADD COLUMN IF NOT EXISTS facebook_post_id text;
