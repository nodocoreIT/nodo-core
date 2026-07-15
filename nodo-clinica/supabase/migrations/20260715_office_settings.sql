-- Migration: office_settings for per-org theme and configuration
-- Table lives in nodo_clinica schema, one row per org.

CREATE TABLE IF NOT EXISTS nodo_clinica.office_settings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        UNIQUE,
  theme_settings   jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS: each doctor reads/writes only their own org's row
ALTER TABLE nodo_clinica.office_settings ENABLE ROW LEVEL SECURITY;

-- Allow members to read their org's settings
CREATE POLICY "office_settings_select" ON nodo_clinica.office_settings
  FOR SELECT
  USING (
    org_id IS NULL
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- Allow members to update their org's settings
CREATE POLICY "office_settings_update" ON nodo_clinica.office_settings
  FOR UPDATE
  USING (
    org_id IS NULL
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- Allow upsert (for orgs that don't have a row yet)
CREATE POLICY "office_settings_insert" ON nodo_clinica.office_settings
  FOR INSERT
  WITH CHECK (
    org_id IS NULL
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
  );
