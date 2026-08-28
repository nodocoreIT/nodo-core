-- Adds "viewed" tracking to recetas so the patient-portal sidebar can badge
-- unread recetas. `viewed_at` is set the first time the patient downloads
-- the PDF (see `/api/clinic/patient-prescriptions/[id]/view`); once set it
-- never resets, regardless of how many more times the receta is downloaded.

-- Standalone recetas ("Recetas" feature, `prescriptions` table).
ALTER TABLE nodo_clinica.prescriptions
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

COMMENT ON COLUMN nodo_clinica.prescriptions.viewed_at IS
  'Timestamp of the first time the patient downloaded this receta''s PDF via the authenticated patient portal. NULL means still unread/pending. Used to compute the "Mis recetas" sidebar badge count.';

-- Live-consultation recetas (`clinical_records`, record_type = 'receta').
ALTER TABLE nodo_clinica.clinical_records
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

COMMENT ON COLUMN nodo_clinica.clinical_records.viewed_at IS
  'Timestamp of the first time the patient downloaded this record''s PDF via the authenticated patient portal. Only ever set for record_type = ''receta'' rows; other record types never populate this column.';
