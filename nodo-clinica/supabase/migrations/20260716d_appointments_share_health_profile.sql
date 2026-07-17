-- Add share_health_profile column to appointments.
-- Lets the patient opt in, per booking, to share their health profile with
-- the doctor. Referenced in code (types + appointments/patient-history routes)
-- but never added via migration, causing "Could not find the column in the
-- schema cache" on appointment creation.

ALTER TABLE nodo_clinica.appointments
  ADD COLUMN IF NOT EXISTS share_health_profile boolean;
