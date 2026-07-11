-- Migration: backup_snapshots table + org-backups storage bucket
-- Applies to: nodo_core Supabase project
-- Creates the metadata table for per-org backup snapshots and the storage bucket.

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nodo_core.backup_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES shared.organizations(id),
  nodo            text        NOT NULL CHECK (nodo IN ('nodo_inmo')),
  snapshot_path   text        NOT NULL UNIQUE,
  row_counts      jsonb       NOT NULL,
  size_bytes      bigint      NOT NULL,
  status          text        NOT NULL CHECK (status IN ('completed', 'failed')),
  error_message   text,
  triggered_by    text        NOT NULL CHECK (triggered_by IN ('cron', 'manual')),
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  restored_at     timestamptz,
  restored_by     uuid        REFERENCES auth.users(id)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE nodo_core.backup_snapshots ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS by default; explicit policies for regular roles:

-- Panel admins (role = 'admin' or 'super_admin') may read all snapshots.
CREATE POLICY "backup_snapshots_select_panel_admin"
  ON nodo_core.backup_snapshots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM nodo_core.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- service_role can insert (bypasses RLS, but explicit policy for clarity).
-- In practice, service_role bypasses RLS; this policy is a safety net.
CREATE POLICY "backup_snapshots_insert_service_role"
  ON nodo_core.backup_snapshots
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "backup_snapshots_update_service_role"
  ON nodo_core.backup_snapshots
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Storage bucket ───────────────────────────────────────────────────────────

-- Create the private storage bucket for org backup files.
-- Files are accessible only via service_role (server-side signed URLs).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-backups',
  'org-backups',
  false,
  104857600, -- 100 MB max file size
  ARRAY['application/gzip', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only service_role can read/write (no public access).
-- The bucket is private; authenticated users should use signed URLs via server.
CREATE POLICY "org_backups_service_role_all"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'org-backups')
  WITH CHECK (bucket_id = 'org-backups');
