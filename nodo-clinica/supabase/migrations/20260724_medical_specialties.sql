-- Migration: medical specialties catalog for doctor onboarding / office settings
--
-- In production, data lives in public.medical_specialties and nodo_clinica exposes it
-- via a view (same pattern as other shared catalogs). Do NOT create a table in
-- nodo_clinica — that name is reserved for the view.

CREATE TABLE IF NOT EXISTS public.medical_specialties (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_specialties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can read approved specialties" ON public.medical_specialties;
DROP POLICY IF EXISTS "medical_specialties_select_approved" ON public.medical_specialties;

CREATE POLICY "medical_specialties_select_approved"
  ON public.medical_specialties
  FOR SELECT
  USING (status = 'approved');

CREATE OR REPLACE VIEW nodo_clinica.medical_specialties AS
  SELECT id, name, status, created_at, updated_at
  FROM public.medical_specialties;

GRANT SELECT ON public.medical_specialties TO anon, authenticated;
GRANT SELECT ON nodo_clinica.medical_specialties TO anon, authenticated;

-- Idempotent seed: works even if the legacy table has no UNIQUE(name) constraint.
INSERT INTO public.medical_specialties (name)
SELECT seed.name
FROM (
  VALUES
    ('Anestesiología'),
    ('Cardiología'),
    ('Cirugía General'),
    ('Cirugía Plástica'),
    ('Dermatología'),
    ('Endocrinología'),
    ('Gastroenterología'),
    ('Geriatría'),
    ('Ginecología'),
    ('Hematología'),
    ('Infectología'),
    ('Medicina de Urgencias'),
    ('Medicina del Trabajo'),
    ('Medicina General'),
    ('Medicina Interna'),
    ('Nefrología'),
    ('Neurología'),
    ('Obstetricia'),
    ('Oftalmología'),
    ('Oncología'),
    ('Otorrinolaringología'),
    ('Pediatría'),
    ('Psiquiatría'),
    ('Radiología'),
    ('Reumatología'),
    ('Traumatología'),
    ('Urología')
) AS seed(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.medical_specialties ms
  WHERE ms.name = seed.name
);

-- Enforce uniqueness going forward (skip if legacy duplicates exist).
CREATE UNIQUE INDEX IF NOT EXISTS medical_specialties_name_key
  ON public.medical_specialties (name);
