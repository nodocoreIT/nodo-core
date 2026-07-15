-- Site feature flags in configuracion table
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('feature_catalogo',     'false', 'Mostrar sección de catálogo en el sitio'),
  ('feature_faq',          'true',  'Mostrar página de preguntas frecuentes'),
  ('feature_nosotros',     'true',  'Mostrar página Quiénes Somos'),
  ('feature_whatsapp',     'true',  'Mostrar botón flotante de WhatsApp'),
  ('feature_newsletter',   'true',  'Mostrar modal de newsletter'),
  ('feature_quick_search', 'true',  'Mostrar búsqueda rápida (Ctrl+K)')
ON CONFLICT (clave) DO NOTHING;

-- Free shipping config
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('shipping_banner_enabled', 'false', 'Mostrar banner de envío en el header'),
  ('shipping_banner_text',    'ENVÍO GRATIS en tu primera compra', 'Texto personalizable del banner de envío'),
  ('shipping_free_from',      '', 'Monto mínimo para envío gratis (vacío = sin mínimo)')
ON CONFLICT (clave) DO NOTHING;
