-- Migration: add ai_settings to nodo_autos.clientes
-- Safe: additive only, nullable column, no data touched
-- Rollback: see bottom of this file

ALTER TABLE nodo_autos.clientes
  ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT NULL;

COMMENT ON COLUMN nodo_autos.clientes.ai_settings IS
  'AI provider configuration: { provider, geminiApiKey, openaiApiKey, anthropicApiKey, groqApiKey }';

-- ============================================================
-- ROLLBACK (run this to undo — copy/paste en Supabase SQL editor)
-- ============================================================
-- ALTER TABLE nodo_autos.clientes DROP COLUMN IF EXISTS ai_settings;
