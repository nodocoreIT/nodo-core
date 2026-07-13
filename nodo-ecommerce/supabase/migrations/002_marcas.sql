-- Tabla de marcas
CREATE TABLE marcas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- RLS
ALTER TABLE marcas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read marcas"
  ON marcas FOR SELECT
  USING (true);

CREATE POLICY "Admin manage marcas"
  ON marcas FOR ALL
  USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Bucket for brand logos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('marcas', 'marcas', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read marcas bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marcas');

CREATE POLICY "Admin upload marcas bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'marcas' AND
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "Admin delete marcas bucket"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'marcas' AND
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );
