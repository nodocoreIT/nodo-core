-- Enable Realtime replication for nodo_clinica.appointments.
-- Without this, postgres_changes subscriptions connect successfully but never
-- receive events, since Postgres logical replication only emits changes for
-- tables added to a publication. This is what the doctor dashboard
-- (doctor-appointments channel) and patient waiting room rely on for live
-- updates instead of requiring a manual page refresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'nodo_clinica'
      AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE nodo_clinica.appointments;
  END IF;
END $$;
