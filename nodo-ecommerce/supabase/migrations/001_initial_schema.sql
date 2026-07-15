-- ============================================================
-- SCHEMA INICIAL - nodo-ecommerce
-- ============================================================

-- 1. CATEGORIAS
CREATE TABLE categorias (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  slug   TEXT NOT NULL,
  orden  INTEGER NOT NULL DEFAULT 0,
  color  TEXT,
  icon   TEXT
);

-- 2. SUBCATEGORIAS
CREATE TABLE subcategorias (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  slug         TEXT NOT NULL,
  orden        INTEGER NOT NULL DEFAULT 0,
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE
);

-- 3. PRODUCTOS
CREATE TABLE productos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               TEXT NOT NULL,
  marca                TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  descripcion          TEXT NOT NULL DEFAULT '',
  descripcion_corta    TEXT,
  precio_costo         NUMERIC(12,2),
  precio_venta         NUMERIC(12,2) NOT NULL,
  stock                INTEGER NOT NULL DEFAULT 0,
  imagen_url           TEXT,
  imagenes_adicionales TEXT[] DEFAULT '{}',
  categoria_id         UUID REFERENCES categorias(id) ON DELETE SET NULL,
  subcategoria_id      UUID REFERENCES subcategorias(id) ON DELETE SET NULL,
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  destacado            BOOLEAN NOT NULL DEFAULT FALSE,
  nuevo                BOOLEAN NOT NULL DEFAULT FALSE,
  meta_titulo          TEXT,
  meta_descripcion     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PEDIDOS
CREATE TABLE pedidos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido     TEXT NOT NULL,
  cliente_nombre    TEXT NOT NULL,
  cliente_apellido  TEXT NOT NULL,
  cliente_telefono  TEXT NOT NULL,
  cliente_email     TEXT,
  cliente_direccion TEXT,
  cliente_notas     TEXT,
  items             JSONB NOT NULL DEFAULT '[]',
  subtotal          NUMERIC(12,2) NOT NULL,
  total             NUMERIC(12,2) NOT NULL,
  metodo_pago       TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'mercadopago')),
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'confirmado', 'preparado', 'entregado', 'cancelado')),
  mp_preference_id  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CONFIGURACION (key-value store)
CREATE TABLE configuracion (
  clave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL DEFAULT '',
  descripcion TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PERFILES (vinculada a auth.users)
CREATE TABLE perfiles (
  id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol TEXT NOT NULL DEFAULT 'admin'
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_productos_activo        ON productos(activo);
CREATE INDEX idx_productos_destacado     ON productos(destacado);
CREATE INDEX idx_productos_slug          ON productos(slug);
CREATE INDEX idx_productos_categoria_id  ON productos(categoria_id);
CREATE INDEX idx_subcategorias_categoria ON subcategorias(categoria_id);
CREATE INDEX idx_pedidos_estado          ON pedidos(estado);
CREATE INDEX idx_pedidos_created_at      ON pedidos(created_at DESC);

-- ============================================================
-- TRIGGER updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE productos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles    ENABLE ROW LEVEL SECURITY;

-- Lectura pública
CREATE POLICY "public_read_productos"
  ON productos FOR SELECT USING (activo = true);

CREATE POLICY "public_read_categorias"
  ON categorias FOR SELECT USING (true);

CREATE POLICY "public_read_subcategorias"
  ON subcategorias FOR SELECT USING (activo = true);

CREATE POLICY "public_read_configuracion"
  ON configuracion FOR SELECT USING (true);

-- Pedidos: INSERT público (checkout sin login), SELECT público (confirmación)
CREATE POLICY "public_insert_pedidos"
  ON pedidos FOR INSERT WITH CHECK (true);

CREATE POLICY "public_select_pedidos"
  ON pedidos FOR SELECT USING (true);

-- Admin: acceso total
CREATE POLICY "admin_all_productos"
  ON productos FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_all_pedidos"
  ON pedidos FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_all_configuracion"
  ON configuracion FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_all_categorias"
  ON categorias FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_all_subcategorias"
  ON subcategorias FOR ALL
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "perfiles_own"
  ON perfiles FOR SELECT USING (id = auth.uid());

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('productos', 'productos', true),
  ('avatars',   'avatars',   true),
  ('slides',    'slides',    true),
  ('branding',  'branding',  true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública
CREATE POLICY "public_read_storage_productos"
  ON storage.objects FOR SELECT USING (bucket_id = 'productos');

CREATE POLICY "public_read_storage_avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "public_read_storage_slides"
  ON storage.objects FOR SELECT USING (bucket_id = 'slides');

CREATE POLICY "public_read_storage_branding"
  ON storage.objects FOR SELECT USING (bucket_id = 'branding');

-- Escritura solo admin
CREATE POLICY "admin_write_storage_productos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'productos' AND EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_write_storage_avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_write_storage_slides"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'slides' AND EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_write_storage_branding"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'branding' AND EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_delete_storage_productos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'productos' AND EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_delete_storage_avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_delete_storage_slides"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'slides' AND EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_delete_storage_branding"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'branding' AND EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- ============================================================
-- DATOS INICIALES
-- ============================================================
INSERT INTO configuracion (clave, valor) VALUES
  ('site_name',           'Mi Tienda'),
  ('site_tagline',        'Tu tienda online'),
  ('color_primary',       '#D4AF37'),
  ('color_primary_light', '#E8C84A'),
  ('color_primary_dark',  '#B8941F'),
  ('color_bg',            '#000000'),
  ('color_surface',       '#0D0D0D'),
  ('color_text',          '#FFFFFF'),
  ('logo_url',            ''),
  ('favicon_url',         ''),
  ('nav_modules_enabled', '["productos","carrousel","pedidos","categorias","mis-datos","datos-bancarios","tema"]'),
  ('hero_slides',         '[]'),
  ('instagram',           ''),
  ('whatsapp',            ''),
  ('facebook',            ''),
  ('tiktok',              ''),
  ('nombre_completo',     ''),
  ('telefono',            ''),
  ('cuentas_bancarias',   '[]')
ON CONFLICT (clave) DO NOTHING;

-- ============================================================
-- PASO FINAL: insertar usuario admin
-- Reemplazá <USER_UUID> con el UUID de tu usuario en Auth > Users
-- ============================================================
-- INSERT INTO perfiles (id, rol) VALUES ('<USER_UUID>', 'admin');
