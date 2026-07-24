-- Enable Realtime replication for nodo_clinica.patient_documents so the
-- doctor dashboard and patient ficha update live when a patient uploads a
-- new document, instead of requiring a manual refresh. Same missing-publication
-- issue as nodo_clinica.appointments (see 20260727_appointments_realtime.sql).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'nodo_clinica'
      AND tablename = 'patient_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE nodo_clinica.patient_documents;
  END IF;
END $$;
