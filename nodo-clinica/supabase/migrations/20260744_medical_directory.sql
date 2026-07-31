-- Directorio de servicios médicos por categoría y ciudad (laboratorios de
-- análisis clínicos, centros de diagnóstico por imágenes, etc. — fuente:
-- Google Places vía Apify). A diferencia del turnero de farmacias, estos
-- datos no rotan mes a mes — un row por local, se actualiza/reemplaza por
-- (ciudad, categoría, place_id) cuando corre la ingesta.
CREATE TABLE IF NOT EXISTS nodo_clinica.medical_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL DEFAULT 'Santa Rosa',
  category text NOT NULL,
  place_id text NOT NULL,
  name text NOT NULL,
  address text,
  phone text,
  website text,
  lat double precision,
  lon double precision,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city, category, place_id)
);

ALTER TABLE nodo_clinica.medical_directory ENABLE ROW LEVEL SECURITY;

-- Info pública de comercios, no ligada a un paciente/org puntual — cualquier
-- usuario autenticado del nodo puede leerla. Sin policies de escritura: el
-- cron/la ingesta on-demand usan service role, que bypasea RLS.
CREATE POLICY medical_directory_select ON nodo_clinica.medical_directory
  FOR SELECT
  TO authenticated
  USING (true);
