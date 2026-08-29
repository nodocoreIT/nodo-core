-- Migration: link presencial appointments to the institution they happen at
-- A doctor can have several institutions, each with its own weekly schedule
-- (nodo_clinica.institutions.schedule, already collected in Instituciones —
-- previously unused). When a patient books a turno presencial, the backend
-- resolves which institution's schedule block matches the chosen time and
-- snapshots it here, so the confirmation email/appointment keeps showing the
-- right address even if the institution is edited or deactivated later.

ALTER TABLE nodo_clinica.appointments
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES nodo_clinica.institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS institution_snapshot jsonb;
