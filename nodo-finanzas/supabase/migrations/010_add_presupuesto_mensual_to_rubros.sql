-- Optional monthly spending budget per rubro. NULL means no budget set —
-- the rubro isn't tracked on the new Presupuestos screen or in bell alerts.
-- Recurring by design: compared against the CURRENT month's spending on
-- every read, no month/year column needed — it resets automatically.
alter table nodo_finanzas_personales.rubros
  add column if not exists presupuesto_mensual numeric;

comment on column nodo_finanzas_personales.rubros.presupuesto_mensual is
  'Monthly spending budget for this rubro (ARS). NULL = no budget tracked. Compared against the current calendar month''s gastos_diarios + gastos_fijos for this rubro.';
