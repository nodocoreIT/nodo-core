-- Migration: add hora column to gastos_diarios
-- Stores the time (HH:MM) when the expense was recorded.
-- Optional: existing rows will have NULL, which is handled gracefully in the UI.

ALTER TABLE nodo_finanzas_personales.gastos_diarios
  ADD COLUMN IF NOT EXISTS hora VARCHAR(5);

-- ============================================================
-- ROLLBACK (run this to undo — copy/paste en Supabase SQL editor)
-- ============================================================
-- ALTER TABLE nodo_finanzas_personales.gastos_diarios DROP COLUMN IF EXISTS hora;
