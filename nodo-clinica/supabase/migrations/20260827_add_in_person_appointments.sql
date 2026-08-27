-- Migration: in_person_availability (parallel agenda to office_settings/virtual)
-- + appointments.appointment_type to tag virtual vs in-person turnos.
-- Mirrors nodo_clinica.office_settings exactly (PK = professional_id, org-scoped
-- RLS via nodo_clinica.current_org_id()) so it plugs into the existing
-- schedule.ts / DoctorAvailability code paths without changes.

CREATE TABLE IF NOT EXISTS nodo_clinica.in_person_availability (
  professional_id  uuid PRIMARY KEY REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES shared.organizations(id),
  availability     jsonb NOT NULL DEFAULT '{"days": [], "slotDurationMinutes": 30}'::jsonb,
  location_info    jsonb NOT NULL DEFAULT '{}'::jsonb, -- {"address": "...", "phone": "...", "parkingNotes": "..."}
  enabled          boolean NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nodo_clinica.in_person_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON nodo_clinica.in_person_availability
  FOR SELECT
  USING (org_id = nodo_clinica.current_org_id());

CREATE POLICY "org_insert" ON nodo_clinica.in_person_availability
  FOR INSERT
  WITH CHECK (org_id = nodo_clinica.current_org_id());

CREATE POLICY "org_update" ON nodo_clinica.in_person_availability
  FOR UPDATE
  USING (org_id = nodo_clinica.current_org_id())
  WITH CHECK (org_id = nodo_clinica.current_org_id());

CREATE POLICY "org_delete" ON nodo_clinica.in_person_availability
  FOR DELETE
  USING (org_id = nodo_clinica.current_org_id());

CREATE INDEX IF NOT EXISTS idx_in_person_availability_org
  ON nodo_clinica.in_person_availability(org_id);

-- appointment_type: text + CHECK, matching the existing `status` /
-- `payment_status` / `refund_method` columns on this table (they're all
-- `text`, never varchar(n)).
ALTER TABLE nodo_clinica.appointments
  ADD COLUMN IF NOT EXISTS appointment_type text NOT NULL DEFAULT 'virtual'
  CHECK (appointment_type IN ('virtual', 'in_person'));

CREATE INDEX IF NOT EXISTS idx_appointments_type
  ON nodo_clinica.appointments(appointment_type);
