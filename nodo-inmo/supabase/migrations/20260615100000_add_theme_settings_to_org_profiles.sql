-- Add theme_settings jsonb column to nodo_inmo.org_profiles
-- Stores panel customization (colors, font, logo type, border radius) per org.
-- Nullable so existing rows need no backfill — app falls back to localStorage
-- defaults when the column is null (graceful first-run).

alter table nodo_inmo.org_profiles
  add column if not exists theme_settings jsonb default null;
