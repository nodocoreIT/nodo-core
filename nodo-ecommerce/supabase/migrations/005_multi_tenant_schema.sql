-- ============================================================
-- NODO ECOMMERCE — Multi-Tenant Schema
-- Schema: nodo_ecommerce
-- Isolation: org_id = auth.uid() (one user = one store)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS nodo_ecommerce;

-- ============================================================
-- HELPER: get current user's org_id
-- ============================================================
CREATE OR REPLACE FUNCTION nodo_ecommerce.current_org_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT auth.uid()
$$;

-- ============================================================
-- 1. STORES — tenant registry + domain config
-- ============================================================
CREATE TABLE nodo_ecommerce.stores (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL UNIQUE DEFAULT auth.uid(),
  store_name    text        NOT NULL DEFAULT '',
  slug          text        UNIQUE,          -- ferreteriacarlitos → ferreteriacarlitos.nodocore.com.ar
  custom_domain text        UNIQUE,          -- www.ferreteriacarlitos.com.ar (fase 2)
  plan          text        NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro')),
  status        text        NOT NULL DEFAULT 'active'  CHECK (status IN ('active', 'suspended', 'trial')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nodo_ecommerce.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on stores"
  ON nodo_ecommerce.stores FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- Public: read store metadata by slug (for public storefronts)
CREATE POLICY "Public read stores by slug"
  ON nodo_ecommerce.stores FOR SELECT
  USING (status = 'active' AND slug IS NOT NULL);

-- ============================================================
-- 2. SITE CONFIG — per-store settings (1:1 with stores)
-- ============================================================
CREATE TABLE nodo_ecommerce.site_config (
  id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid         NOT NULL UNIQUE DEFAULT auth.uid(),
  -- Identidad
  store_name               text         NOT NULL DEFAULT '',
  description              text,
  logo_url                 text,
  favicon_url              text,
  -- Contacto
  email                    text,
  phone                    text,
  whatsapp                 text,
  address                  text,
  -- Redes sociales
  instagram_url            text,
  facebook_url             text,
  tiktok_url               text,
  youtube_url              text,
  -- Tema visual
  primary_color            text         NOT NULL DEFAULT '#000000',
  secondary_color          text         NOT NULL DEFAULT '#ffffff',
  font                     text         NOT NULL DEFAULT 'Inter',
  site_theme               text         NOT NULL DEFAULT 'light' CHECK (site_theme IN ('light', 'dark')),
  -- Envíos
  shipping_banner_enabled  boolean      NOT NULL DEFAULT false,
  shipping_banner_text     text         NOT NULL DEFAULT 'ENVÍO GRATIS en tu primera compra',
  shipping_cost            numeric(12,2) NOT NULL DEFAULT 0,
  free_shipping_from       numeric(12,2),
  -- Negocio
  currency                 text         NOT NULL DEFAULT 'ARS',
  accepts_usd              boolean      NOT NULL DEFAULT false,
  installments_enabled     boolean      NOT NULL DEFAULT false,
  -- Features
  feature_catalogo         boolean      NOT NULL DEFAULT false,
  feature_faq              boolean      NOT NULL DEFAULT true,
  feature_nosotros         boolean      NOT NULL DEFAULT true,
  feature_whatsapp         boolean      NOT NULL DEFAULT true,
  feature_newsletter       boolean      NOT NULL DEFAULT true,
  feature_quick_search     boolean      NOT NULL DEFAULT true,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE nodo_ecommerce.site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on site_config"
  ON nodo_ecommerce.site_config FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- Public storefronts need to read the config to render the store
CREATE POLICY "Public read site_config"
  ON nodo_ecommerce.site_config FOR SELECT
  USING (true);

-- ============================================================
-- 3. CATEGORIES
-- ============================================================
CREATE TABLE nodo_ecommerce.categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL DEFAULT auth.uid(),
  name        text        NOT NULL,
  slug        text        NOT NULL,
  color       text,
  icon        text,
  order_index integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

ALTER TABLE nodo_ecommerce.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on categories"
  ON nodo_ecommerce.categories FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

CREATE POLICY "Public read categories"
  ON nodo_ecommerce.categories FOR SELECT
  USING (true);

-- ============================================================
-- 4. SUBCATEGORIES
-- ============================================================
CREATE TABLE nodo_ecommerce.subcategories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL DEFAULT auth.uid(),
  category_id uuid        NOT NULL REFERENCES nodo_ecommerce.categories(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  slug        text        NOT NULL,
  order_index integer     NOT NULL DEFAULT 0,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

ALTER TABLE nodo_ecommerce.subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on subcategories"
  ON nodo_ecommerce.subcategories FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

CREATE POLICY "Public read subcategories"
  ON nodo_ecommerce.subcategories FOR SELECT
  USING (true);

-- ============================================================
-- 5. BRANDS (marcas)
-- ============================================================
CREATE TABLE nodo_ecommerce.brands (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL DEFAULT auth.uid(),
  name        text        NOT NULL,
  slug        text        NOT NULL,
  logo_url    text,
  description text,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

ALTER TABLE nodo_ecommerce.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on brands"
  ON nodo_ecommerce.brands FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

CREATE POLICY "Public read brands"
  ON nodo_ecommerce.brands FOR SELECT
  USING (true);

-- ============================================================
-- 6. PROVIDERS (proveedores / suppliers)
-- ============================================================
CREATE TABLE nodo_ecommerce.providers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL DEFAULT auth.uid(),
  name         text        NOT NULL,
  contact_name text,
  email        text,
  phone        text,
  address      text,
  website      text,
  notes        text,
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nodo_ecommerce.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on providers"
  ON nodo_ecommerce.providers FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- ============================================================
-- 7. PRODUCTS (productos)
-- ============================================================
CREATE TABLE nodo_ecommerce.products (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid          NOT NULL DEFAULT auth.uid(),
  name                 text          NOT NULL,
  slug                 text          NOT NULL,
  short_description    text,
  description          text          NOT NULL DEFAULT '',
  cost_price           numeric(12,2),
  sale_price           numeric(12,2) NOT NULL DEFAULT 0,
  compare_at_price     numeric(12,2),           -- precio tachado
  stock                integer       NOT NULL DEFAULT 0,
  track_stock          boolean       NOT NULL DEFAULT true,
  sku                  text,
  image_url            text,
  extra_images         text[]        NOT NULL DEFAULT '{}',
  category_id          uuid          REFERENCES nodo_ecommerce.categories(id)    ON DELETE SET NULL,
  subcategory_id       uuid          REFERENCES nodo_ecommerce.subcategories(id)  ON DELETE SET NULL,
  brand_id             uuid          REFERENCES nodo_ecommerce.brands(id)         ON DELETE SET NULL,
  provider_id          uuid          REFERENCES nodo_ecommerce.providers(id)      ON DELETE SET NULL,
  active               boolean       NOT NULL DEFAULT true,
  featured             boolean       NOT NULL DEFAULT false,
  is_new               boolean       NOT NULL DEFAULT false,
  meta_title           text,
  meta_description     text,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

ALTER TABLE nodo_ecommerce.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on products"
  ON nodo_ecommerce.products FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

CREATE POLICY "Public read active products"
  ON nodo_ecommerce.products FOR SELECT
  USING (active = true);

-- ============================================================
-- 8. BANNERS (carousel)
-- ============================================================
CREATE TABLE nodo_ecommerce.banners (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL DEFAULT auth.uid(),
  title       text,
  subtitle    text,
  image_url   text        NOT NULL,
  link_url    text,
  order_index integer     NOT NULL DEFAULT 0,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nodo_ecommerce.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on banners"
  ON nodo_ecommerce.banners FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

CREATE POLICY "Public read active banners"
  ON nodo_ecommerce.banners FOR SELECT
  USING (active = true);

-- ============================================================
-- 9. CUSTOMERS (clientes de la tienda)
-- ============================================================
CREATE TABLE nodo_ecommerce.customers (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL,
  email      text        NOT NULL,
  first_name text        NOT NULL DEFAULT '',
  last_name  text        NOT NULL DEFAULT '',
  phone      text,
  address    text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

ALTER TABLE nodo_ecommerce.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on customers"
  ON nodo_ecommerce.customers FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- Anonymous can insert when placing an order (upsert pattern)
CREATE POLICY "Public insert customers"
  ON nodo_ecommerce.customers FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 10. ORDERS (pedidos)
-- ============================================================
CREATE TABLE nodo_ecommerce.orders (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid          NOT NULL,
  order_number     text          NOT NULL,
  customer_id      uuid          REFERENCES nodo_ecommerce.customers(id) ON DELETE SET NULL,
  -- Snapshot del cliente al momento del pedido
  customer_name    text          NOT NULL DEFAULT '',
  customer_phone   text          NOT NULL DEFAULT '',
  customer_email   text,
  customer_address text,
  customer_notes   text,
  -- Items (snapshot de productos al momento del pedido)
  items            jsonb         NOT NULL DEFAULT '[]',
  -- Totales
  subtotal         numeric(12,2) NOT NULL DEFAULT 0,
  shipping_cost    numeric(12,2) NOT NULL DEFAULT 0,
  discount         numeric(12,2) NOT NULL DEFAULT 0,
  total            numeric(12,2) NOT NULL DEFAULT 0,
  -- Estado
  status           text          NOT NULL DEFAULT 'pendiente'
                     CHECK (status IN ('pendiente', 'confirmado', 'preparado', 'entregado', 'cancelado')),
  payment_method   text          NOT NULL DEFAULT 'efectivo'
                     CHECK (payment_method IN ('efectivo', 'transferencia', 'mercadopago', 'otro')),
  payment_status   text          NOT NULL DEFAULT 'pendiente'
                     CHECK (payment_status IN ('pendiente', 'pagado', 'reembolsado')),
  -- MercadoPago
  mp_preference_id text,
  mp_payment_id    text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE nodo_ecommerce.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on orders"
  ON nodo_ecommerce.orders FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- Anonymous can create orders (public checkout)
CREATE POLICY "Public insert orders"
  ON nodo_ecommerce.orders FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 11. PAYMENT CONFIGS (pasarelas de pago)
-- ============================================================
CREATE TABLE nodo_ecommerce.payment_configs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL DEFAULT auth.uid(),
  provider    text        NOT NULL CHECK (provider IN ('mercadopago', 'payway', 'transferencia', 'efectivo')),
  enabled     boolean     NOT NULL DEFAULT false,
  credentials jsonb       NOT NULL DEFAULT '{}', -- access_token, public_key, etc.
  config      jsonb       NOT NULL DEFAULT '{}', -- cuotas, recargo, etc.
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

ALTER TABLE nodo_ecommerce.payment_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on payment_configs"
  ON nodo_ecommerce.payment_configs FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- ============================================================
-- 12. BANK ACCOUNTS (datos bancarios para transferencias)
-- ============================================================
CREATE TABLE nodo_ecommerce.bank_accounts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL DEFAULT auth.uid(),
  bank_name      text        NOT NULL DEFAULT '',
  account_holder text        NOT NULL DEFAULT '',
  account_type   text,                            -- caja-ahorro, cuenta-corriente
  cbu            text,
  alias          text,
  cuit           text,
  is_primary     boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nodo_ecommerce.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on bank_accounts"
  ON nodo_ecommerce.bank_accounts FOR ALL
  USING  (org_id = auth.uid())
  WITH CHECK (org_id = auth.uid());

-- Public storefronts need bank details to show transfer instructions
CREATE POLICY "Public read bank_accounts"
  ON nodo_ecommerce.bank_accounts FOR SELECT
  USING (true);

-- ============================================================
-- INDEXES (rendimiento en queries comunes)
-- ============================================================
CREATE INDEX idx_products_org_id     ON nodo_ecommerce.products(org_id);
CREATE INDEX idx_products_active     ON nodo_ecommerce.products(org_id, active);
CREATE INDEX idx_products_featured   ON nodo_ecommerce.products(org_id, featured) WHERE featured = true;
CREATE INDEX idx_products_category   ON nodo_ecommerce.products(org_id, category_id);
CREATE INDEX idx_products_slug       ON nodo_ecommerce.products(org_id, slug);

CREATE INDEX idx_orders_org_id       ON nodo_ecommerce.orders(org_id);
CREATE INDEX idx_orders_status       ON nodo_ecommerce.orders(org_id, status);
CREATE INDEX idx_orders_created      ON nodo_ecommerce.orders(org_id, created_at DESC);

CREATE INDEX idx_customers_org_id    ON nodo_ecommerce.customers(org_id);
CREATE INDEX idx_categories_org_id   ON nodo_ecommerce.categories(org_id);
CREATE INDEX idx_brands_org_id       ON nodo_ecommerce.brands(org_id);
CREATE INDEX idx_providers_org_id    ON nodo_ecommerce.providers(org_id);
CREATE INDEX idx_banners_org_id      ON nodo_ecommerce.banners(org_id, active);

-- Lookup by slug for public storefronts
CREATE INDEX idx_stores_slug         ON nodo_ecommerce.stores(slug);
CREATE INDEX idx_stores_custom_domain ON nodo_ecommerce.stores(custom_domain);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Productos (imágenes de productos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ecommerce-productos', 'ecommerce-productos', true)
ON CONFLICT (id) DO NOTHING;

-- Banners (carousel del sitio)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ecommerce-banners', 'ecommerce-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Logos de marcas
INSERT INTO storage.buckets (id, name, public)
VALUES ('ecommerce-marcas', 'ecommerce-marcas', true)
ON CONFLICT (id) DO NOTHING;

-- Assets generales del sitio (logo, favicon)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ecommerce-assets', 'ecommerce-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: public read all ecommerce buckets
CREATE POLICY "Public read ecommerce-productos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ecommerce-productos');

CREATE POLICY "Public read ecommerce-banners"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ecommerce-banners');

CREATE POLICY "Public read ecommerce-marcas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ecommerce-marcas');

CREATE POLICY "Public read ecommerce-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ecommerce-assets');

-- Storage RLS: authenticated users upload to their own folder (org_id prefix)
CREATE POLICY "Auth upload ecommerce-productos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ecommerce-productos' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth upload ecommerce-banners"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ecommerce-banners' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth upload ecommerce-marcas"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ecommerce-marcas' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth upload ecommerce-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ecommerce-assets' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Auth delete own ecommerce files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('ecommerce-productos', 'ecommerce-banners', 'ecommerce-marcas', 'ecommerce-assets') AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION nodo_ecommerce.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON nodo_ecommerce.stores
  FOR EACH ROW EXECUTE FUNCTION nodo_ecommerce.set_updated_at();

CREATE TRIGGER trg_site_config_updated_at
  BEFORE UPDATE ON nodo_ecommerce.site_config
  FOR EACH ROW EXECUTE FUNCTION nodo_ecommerce.set_updated_at();

CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON nodo_ecommerce.providers
  FOR EACH ROW EXECUTE FUNCTION nodo_ecommerce.set_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON nodo_ecommerce.products
  FOR EACH ROW EXECUTE FUNCTION nodo_ecommerce.set_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON nodo_ecommerce.customers
  FOR EACH ROW EXECUTE FUNCTION nodo_ecommerce.set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON nodo_ecommerce.orders
  FOR EACH ROW EXECUTE FUNCTION nodo_ecommerce.set_updated_at();

CREATE TRIGGER trg_payment_configs_updated_at
  BEFORE UPDATE ON nodo_ecommerce.payment_configs
  FOR EACH ROW EXECUTE FUNCTION nodo_ecommerce.set_updated_at();
