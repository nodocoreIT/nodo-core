-- Migration: create obras_sociales table with seed data (common Argentine obras sociales)

CREATE TABLE IF NOT EXISTS nodo_clinica.obras_sociales (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: anon can SELECT approved rows; service role can INSERT/UPDATE
ALTER TABLE nodo_clinica.obras_sociales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obras_sociales_select_approved"
  ON nodo_clinica.obras_sociales
  FOR SELECT
  USING (status = 'approved');

-- Seed: most common Argentine obras sociales
INSERT INTO nodo_clinica.obras_sociales (name) VALUES
  ('OSDE'),
  ('Swiss Medical'),
  ('Medifé'),
  ('IOMA'),
  ('PAMI'),
  ('Galeno'),
  ('Sancor Salud'),
  ('Accord Salud'),
  ('OSPEDYC'),
  ('OSDEPYM'),
  ('Omint'),
  ('Unión Personal'),
  ('OSECAC'),
  ('OSAM'),
  ('OSTEP'),
  ('OSPOCE'),
  ('OSFATLYF'),
  ('OSFATUN'),
  ('OSPIA'),
  ('Federada Salud'),
  ('Sempre'),
  ('Particular')
ON CONFLICT (name) DO NOTHING;
