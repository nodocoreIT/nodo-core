-- Enable Realtime replication for nodo_core.task_notifications.
-- Without this, postgres_changes subscriptions connect successfully but never
-- receive events, since Postgres logical replication only emits changes for
-- tables added to a publication. This is what the panel bell's instant toast
-- (use-panel-notifications.ts) relies on instead of waiting for the 60s poll.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'nodo_core'
      AND tablename = 'task_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE nodo_core.task_notifications;
  END IF;
END $$;
