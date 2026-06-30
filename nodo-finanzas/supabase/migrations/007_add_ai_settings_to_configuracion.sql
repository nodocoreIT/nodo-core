-- Migration: ai_settings for nodo_finanzas_personales
-- No DDL needed: configuracion_usuario is a key-value store.
-- The app upserts the 'ai_settings' key on first save.
-- This file exists to document the change and keep migration history consistent.

-- No-op intentional.

-- ============================================================
-- ROLLBACK (run this to undo — copy/paste en Supabase SQL editor)
-- ============================================================
-- DELETE FROM nodo_finanzas_personales.configuracion_usuario WHERE clave = 'ai_settings';
