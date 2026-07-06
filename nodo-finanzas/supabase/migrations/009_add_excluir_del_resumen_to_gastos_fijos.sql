-- Migration: add excluir_del_resumen to gastos_fijos
-- When true, the item is excluded from the dashboard "Gastos Fijos Pendientes" total.
-- Useful for items like loans that are already tracked in their own section.
-- Default false = included in sum (preserves existing behavior).

ALTER TABLE nodo_finanzas_personales.gastos_fijos
  ADD COLUMN IF NOT EXISTS excluir_del_resumen BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- ALTER TABLE nodo_finanzas_personales.gastos_fijos DROP COLUMN IF EXISTS excluir_del_resumen;
