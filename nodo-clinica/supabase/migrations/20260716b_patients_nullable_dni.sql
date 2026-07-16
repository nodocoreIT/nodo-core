-- Make dni, first_name and last_name nullable on patients.
-- These were NOT NULL from the onboarding flow but are not available
-- when a patient row is auto-created from the portal (e.g. doctor acting
-- as patient, or a patient registered outside the standard onboarding).

ALTER TABLE nodo_clinica.patients
  ALTER COLUMN dni        DROP NOT NULL,
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name  DROP NOT NULL;
