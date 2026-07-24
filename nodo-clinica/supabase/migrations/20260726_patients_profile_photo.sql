-- patients.profile_photo_url used by doctor-dashboard.tsx (appointments -> patient embed)
-- but was never defined in any migration; only existed on remote via manual dashboard edits.

ALTER TABLE nodo_clinica.patients
  ADD COLUMN IF NOT EXISTS profile_photo_url text;
