-- Turnero mensual de farmacias de turno (fuente: colfarlp.org.ar). Un row
-- por (ciudad, año, mes) — el dataset de un mes se consume/reemplaza entero
-- (día→letra + letra→farmacias), no vale la pena normalizarlo en tablas
-- separadas.
CREATE TABLE IF NOT EXISTS nodo_clinica.pharmacy_on_call_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL DEFAULT 'Santa Rosa',
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  day_letters jsonb NOT NULL,
  letter_pharmacies jsonb NOT NULL,
  source_pdf_url text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, year, month)
);

ALTER TABLE nodo_clinica.pharmacy_on_call_schedules ENABLE ROW LEVEL SECURITY;

-- Info pública de salud (qué farmacia está de turno), no ligada a un
-- paciente/org puntual — cualquier usuario autenticado del nodo puede leerla.
-- Sin policies de escritura: el cron/la ingesta on-demand usan service role,
-- que bypasea RLS.
CREATE POLICY pharmacy_on_call_select ON nodo_clinica.pharmacy_on_call_schedules
  FOR SELECT
  TO authenticated
  USING (true);
