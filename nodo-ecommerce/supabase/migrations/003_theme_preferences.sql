-- Per-user theme preference
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS preferred_theme TEXT NOT NULL DEFAULT 'dark'
  CHECK (preferred_theme IN ('dark', 'light'));

-- Site-wide theme setting in configuracion
INSERT INTO configuracion (clave, valor, descripcion)
VALUES ('site_theme', 'dark', 'Tema del sitio público: dark o light')
ON CONFLICT (clave) DO NOTHING;
