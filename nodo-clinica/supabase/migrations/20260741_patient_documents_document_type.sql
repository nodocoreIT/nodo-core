-- Distinguishes a payment receipt from a medical study/attachment on
-- patient_documents. Without this column, both upload flows (payment
-- receipt vs. pre-consultation studies) landed in the same table with no
-- way to tell them apart, so the doctor's Cobros view (and the automatic
-- "pending review" flag) picked whichever document happened to come back
-- first for the appointment — sometimes a study, shown as if it were the
-- payment receipt.
--
-- Backfill note: existing rows predate this distinction and are, in
-- practice, almost all payment receipts (the "Estudios previos" upload
-- flow is comparatively recent/lightly used) — so the column is added
-- with DEFAULT 'payment_receipt' first, which Postgres also applies to
-- every pre-existing row, preserving today's Cobros view. Only AFTER that
-- backfill does the default flip to 'study', the safe default for any
-- future insert that (unexpectedly) omits the field explicitly — the
-- application code now always sets it explicitly on every upload.
ALTER TABLE nodo_clinica.patient_documents
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'payment_receipt';

ALTER TABLE nodo_clinica.patient_documents
  ALTER COLUMN document_type SET DEFAULT 'study';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patient_documents_document_type_check'
  ) THEN
    ALTER TABLE nodo_clinica.patient_documents
      ADD CONSTRAINT patient_documents_document_type_check
      CHECK (document_type IN ('payment_receipt', 'study'));
  END IF;
END $$;
