-- Migration: add ai_settings to nodo_inmo.org_profiles
-- Safe: additive only, nullable column, no data touched
-- Rollback: see bottom of this file

ALTER TABLE nodo_inmo.org_profiles
  ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT NULL;

COMMENT ON COLUMN nodo_inmo.org_profiles.ai_settings IS
  'AI provider configuration: { provider, geminiApiKey, openaiApiKey, anthropicApiKey, groqApiKey }';

-- ============================================================
-- ROLLBACK (run this to undo — copy/paste in Supabase SQL editor)
-- ============================================================
-- ALTER TABLE nodo_inmo.org_profiles DROP COLUMN IF EXISTS ai_settings;
