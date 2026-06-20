-- Demo seed: RAM Informática (https://www.raminformatica.com.ar/)
-- Org: raminformatica storefront

DO $$
DECLARE
  v_org uuid := '398fb8af-bdbc-4dd6-a124-7034d18b319f';
  v_product_id uuid;
BEGIN
  -- ── Perfil y tienda ──────────────────────────────────────────────────────
  UPDATE nodo_tienda.org_profiles SET
    store_name    = 'RAM Informática',
    tagline       = 'Desde 2008 impulsando tu mundo tecnológico',
    contact_email = 'contacto@raminformatica.com.ar',
    contact_phone = '2954227622',
    address       = 'Lebensohn 3980',
    city          = 'Santa Rosa, La Pampa',
    country       = 'AR',
    currency      = 'ARS',
    timezone      = 'America/Argentina/Buenos_Aires',
    theme_settings = jsonb_build_object(
      'primaryColor', '#1e3a5f',
      'secondaryColor', '#0f172a',
      'fontFamily', 'Inter',
      'borderRadius', 'md',
      'brandText', 'RAM Informática'
    )
  WHERE org_id = v_org;

  UPDATE nodo_tienda.stores SET
    name        = 'RAM Informática',
    description = 'Tecnología premium a precios muy competitivos. Celulares, Macbooks, consolas, cámaras y tablets. Envíos garantizados a todo el país.',
    slug        = 'raminformatica',
    is_active   = true
  WHERE org_id = v_org;

  -- ── Categorías extra ───────────────────────────────────────────────────────
  INSERT INTO nodo_tienda.categories (org_id, name, slug, description, sort_order)
  VALUES
    (v_org, 'Tablets', 'tablets', 'Tablets Android e iPad', 8),
    (v_org, 'Cámaras', 'camaras', 'Cámaras fotográficas y accesorios', 9)
  ON CONFLICT (org_id, slug) DO NOTHING;

  INSERT INTO nodo_tienda.brands (org_id, name, slug, description)
  VALUES (v_org, 'Canon', 'canon', 'Cámaras y óptica')
  ON CONFLICT (org_id, slug) DO NOTHING;

  -- ── Productos ──────────────────────────────────────────────────────────────
  INSERT INTO nodo_tienda.products (
    org_id, name, slug, sku, description, category_id, brand_id,
    price, promotional_price, is_active, is_featured, tags
  )
  SELECT
    v_org,
    v.name,
    v.slug,
    v.sku,
    v.description,
    c.id,
    b.id,
    v.price,
    v.promo,
    true,
    v.featured,
    v.tags
  FROM (VALUES
    (
      'Xiaomi 14T Pro Usado',
      'xiaomi-14t-pro-usado',
      'RAM-X14T-U',
      'Smartphone Xiaomi 14T Pro en excelente estado. Pantalla AMOLED 144Hz, cámara Leica y carga rápida 120W. Ideal para quien busca flagship a precio accesible.',
      'celulares', 'xiaomi', 650000::numeric, 599000::numeric, true,
      ARRAY['usado','destacado','xiaomi']
    ),
    (
      'iPhone 15 128GB',
      'iphone-15-128gb',
      'RAM-IP15-128',
      'iPhone 15 nuevo con chip A16 Bionic, cámara de 48 MP y USB-C. Disponible en varios colores. Consultá stock.',
      'celulares', 'apple', 1150000::numeric, NULL::numeric, true,
      ARRAY['nuevo','iphone','apple']
    ),
    (
      'iPhone 14 Pro 256GB Usado',
      'iphone-14-pro-256gb-usado',
      'RAM-IP14P-U',
      'iPhone 14 Pro usado seleccionado, batería saludable y sin detalles estéticos relevantes. Pantalla Super Retina XDR y cámara Pro.',
      'celulares', 'apple', 890000::numeric, 849000::numeric, true,
      ARRAY['usado','iphone']
    ),
    (
      'MacBook Air M2 13" 256GB',
      'macbook-air-m2-256gb',
      'RAM-MBA-M2',
      'MacBook Air con chip M2, 8 GB RAM y 256 GB SSD. Ultraliviana, ideal para estudio y trabajo. Nueva con garantía oficial.',
      'macbooks', 'apple', 1450000::numeric, NULL::numeric, true,
      ARRAY['nuevo','macbook']
    ),
    (
      'PlayStation 5 Slim',
      'playstation-5-slim',
      'RAM-PS5-SLIM',
      'Consola PlayStation 5 Slim con lector de discos. Incluye un joystick DualSense. Stock limitado en Santa Rosa.',
      'video-juegos', 'sony', 750000::numeric, 729000::numeric, true,
      ARRAY['consola','playstation']
    ),
    (
      'Samsung Galaxy Tab S9 FE',
      'samsung-galaxy-tab-s9-fe',
      'RAM-TAB-S9FE',
      'Tablet Samsung Galaxy Tab S9 FE con pantalla de 10.9", ideal para estudio, streaming y productividad.',
      'tablets', 'samsung', 420000::numeric, NULL::numeric, false,
      ARRAY['tablet','samsung']
    ),
    (
      'Canon EOS R50 Kit 18-45mm',
      'canon-eos-r50-kit',
      'RAM-CAN-R50',
      'Cámara mirrorless Canon EOS R50 con lente 18-45mm. Perfecta para principiantes y creadores de contenido.',
      'camaras', 'canon', 980000::numeric, 949000::numeric, false,
      ARRAY['camara','canon']
    ),
    (
      'Motorola Edge 40 Neo',
      'motorola-edge-40-neo',
      'RAM-MOTO-E40',
      'Motorola Edge 40 Neo con pantalla pOLED 144Hz, carga TurboPower y gran relación precio-calidad.',
      'celulares', 'motorola', 380000::numeric, NULL::numeric, false,
      ARRAY['nuevo','motorola']
    )
  ) AS v(name, slug, sku, description, cat_slug, brand_slug, price, promo, featured, tags)
  JOIN nodo_tienda.categories c ON c.org_id = v_org AND c.slug = v.cat_slug
  JOIN nodo_tienda.brands b ON b.org_id = v_org AND b.slug = v.brand_slug
  ON CONFLICT (org_id, slug) DO UPDATE SET
    name              = EXCLUDED.name,
    description       = EXCLUDED.description,
    category_id       = EXCLUDED.category_id,
    brand_id          = EXCLUDED.brand_id,
    price             = EXCLUDED.price,
    promotional_price = EXCLUDED.promotional_price,
    is_featured       = EXCLUDED.is_featured,
    tags              = EXCLUDED.tags,
    is_active         = true,
    deleted_at        = NULL;

  -- ── Inventario ───────────────────────────────────────────────────────────
  INSERT INTO nodo_tienda.inventory (org_id, product_id, quantity, low_stock_threshold)
  SELECT p.org_id, p.id, v.qty, 2
  FROM nodo_tienda.products p
  JOIN (VALUES
    ('xiaomi-14t-pro-usado', 3),
    ('iphone-15-128gb', 5),
    ('iphone-14-pro-256gb-usado', 2),
    ('macbook-air-m2-256gb', 4),
    ('playstation-5-slim', 6),
    ('samsung-galaxy-tab-s9-fe', 8),
    ('canon-eos-r50-kit', 2),
    ('motorola-edge-40-neo', 10)
  ) AS v(slug, qty) ON p.slug = v.slug
  WHERE p.org_id = v_org
  ON CONFLICT (product_id, variant_id) DO UPDATE SET
    quantity = EXCLUDED.quantity;

  -- ── Imágenes (placeholders) ───────────────────────────────────────────────
  DELETE FROM nodo_tienda.product_images
  WHERE org_id = v_org
    AND product_id IN (SELECT id FROM nodo_tienda.products WHERE org_id = v_org);

  INSERT INTO nodo_tienda.product_images (org_id, product_id, url, alt, sort_order)
  SELECT p.org_id, p.id, v.url, p.name, 0
  FROM nodo_tienda.products p
  JOIN (VALUES
    ('xiaomi-14t-pro-usado', 'https://images.unsplash.com/photo-1598327666104-0677b84f9387?w=800&q=80'),
    ('iphone-15-128gb', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80'),
    ('iphone-14-pro-256gb-usado', 'https://images.unsplash.com/photo-1678652197950-4a04b2ed7f9b?w=800&q=80'),
    ('macbook-air-m2-256gb', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80'),
    ('playstation-5-slim', 'https://images.unsplash.com/photo-1606813907295-d86efa9b94ae?w=800&q=80'),
    ('samsung-galaxy-tab-s9-fe', 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80'),
    ('canon-eos-r50-kit', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80'),
    ('motorola-edge-40-neo', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80')
  ) AS v(slug, url) ON p.slug = v.slug
  WHERE p.org_id = v_org;

  -- ── Secciones del home ───────────────────────────────────────────────────
  DELETE FROM nodo_tienda.store_sections WHERE org_id = v_org;

  INSERT INTO nodo_tienda.store_sections (org_id, type, title, config, sort_order, is_active)
  VALUES
    (v_org, 'hero', NULL, jsonb_build_object(
      'title', 'Tecnología premium a precios muy competitivos',
      'subtitle', 'Celulares, Macbooks, consolas, cámaras y tablets. Precios en dólares y pesos actualizados a diario.',
      'cta_label', 'Ver productos',
      'cta_url', '/raminformatica/catalog'
    ), 0, true),
    (v_org, 'featured_products', 'Productos destacados', jsonb_build_object('limit', 8), 1, true),
    (v_org, 'categories', 'Categorías', '{}'::jsonb, 2, true),
    (v_org, 'text', 'Tu aliado tecnológico en Santa Rosa', jsonb_build_object(
      'content', 'En RAM Informática nos especializamos en acercar lo último en tecnología a La Pampa. Si estás buscando una PlayStation, un iPhone o renovar tu notebook en Santa Rosa, ofrecemos asesoramiento personalizado y los mejores precios del mercado. Desde 2008, envíos garantizados a todo el país.'
    ), 3, true);

  -- ── Menús ────────────────────────────────────────────────────────────────
  INSERT INTO nodo_tienda.store_menus (org_id, location, items)
  VALUES
    (v_org, 'header', '[
      {"label":"Inicio","url":"/raminformatica"},
      {"label":"Catálogo","url":"/raminformatica/catalog"},
      {"label":"Categorías","url":"/raminformatica/catalog"},
      {"label":"Carrito","url":"/raminformatica/cart"}
    ]'::jsonb),
    (v_org, 'footer', '[
      {"label":"Nosotros","url":"/raminformatica"},
      {"label":"Productos","url":"/raminformatica/catalog"},
      {"label":"WhatsApp","url":"https://wa.me/542954227622"},
      {"label":"Cómo comprar","url":"/raminformatica/catalog"}
    ]'::jsonb)
  ON CONFLICT (org_id, location) DO UPDATE SET items = EXCLUDED.items;

END $$;
