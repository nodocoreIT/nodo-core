-- Migration: institutions (Recetas Fase 1)
-- Institutions (clinics/hospitals) where a professional works. Used as
-- letterhead data on future prescription PDFs. Soft-delete only (active
-- flag) — future prescriptions will reference these rows historically, so
-- hard deletes would break that trail.

CREATE TABLE IF NOT EXISTS nodo_clinica.institutions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES shared.organizations(id),
  professional_id  uuid NOT NULL REFERENCES nodo_clinica.professionals(id) ON DELETE CASCADE,
  name             text NOT NULL,
  city             text,
  address          text,
  extra_info       text,
  schedule         jsonb NOT NULL DEFAULT '{"days": []}'::jsonb,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nodo_clinica.institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON nodo_clinica.institutions
  FOR SELECT
  USING (org_id = nodo_clinica.current_org_id());

CREATE POLICY "org_insert" ON nodo_clinica.institutions
  FOR INSERT
  WITH CHECK (org_id = nodo_clinica.current_org_id());

CREATE POLICY "org_update" ON nodo_clinica.institutions
  FOR UPDATE
  USING (org_id = nodo_clinica.current_org_id())
  WITH CHECK (org_id = nodo_clinica.current_org_id());

CREATE POLICY "org_delete" ON nodo_clinica.institutions
  FOR DELETE
  USING (org_id = nodo_clinica.current_org_id());

CREATE INDEX IF NOT EXISTS idx_institutions_org
  ON nodo_clinica.institutions(org_id);

CREATE INDEX IF NOT EXISTS idx_institutions_professional
  ON nodo_clinica.institutions(professional_id);
