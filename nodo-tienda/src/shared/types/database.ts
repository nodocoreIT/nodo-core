export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

// ── Row types ─────────────────────────────────────────────────────────────────

export type StoreRow = {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  custom_domain: string | null;
  domain_verified_at: string | null;
  domain_verify_token: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreInsert = Omit<StoreRow, "id" | "created_at" | "updated_at">;
export type StoreUpdate = Partial<StoreInsert>;

export type OrgProfileRow = {
  id: string;
  org_id: string;
  store_name: string | null;
  tagline: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  timezone: string;
  theme_settings: Json | null;
  created_at: string;
  updated_at: string;
};

export type OrgProfileInsert = Omit<OrgProfileRow, "id" | "created_at" | "updated_at">;
export type OrgProfileUpdate = Partial<OrgProfileInsert>;

export type CategoryRow = {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CategoryInsert = Omit<CategoryRow, "id" | "created_at" | "updated_at">;
export type CategoryUpdate = Partial<CategoryInsert>;

export type BrandRow = {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandInsert = Omit<BrandRow, "id" | "created_at" | "updated_at">;
export type BrandUpdate = Partial<BrandInsert>;

export type ProductRow = {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  category_id: string | null;
  brand_id: string | null;
  price: number;
  promotional_price: number | null;
  cost: number | null;
  is_active: boolean;
  is_featured: boolean;
  has_variants: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductInsert = Omit<ProductRow, "id" | "created_at" | "updated_at">;
export type ProductUpdate = Partial<ProductInsert>;

export type ProductVariantRow = {
  id: string;
  org_id: string;
  product_id: string;
  sku: string | null;
  attributes: Json;
  price_override: number | null;
  cost_override: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductVariantInsert = Omit<ProductVariantRow, "id" | "created_at" | "updated_at">;
export type ProductVariantUpdate = Partial<ProductVariantInsert>;

export type ProductImageRow = {
  id: string;
  org_id: string;
  product_id: string;
  url: string;
  alt: string | null;
  sort_order: number;
  created_at: string;
};

export type ProductImageInsert = Omit<ProductImageRow, "id" | "created_at">;
export type ProductImageUpdate = Partial<ProductImageInsert>;

export type InventoryRow = {
  id: string;
  org_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
};

export type InventoryInsert = Omit<InventoryRow, "id" | "created_at" | "updated_at">;
export type InventoryUpdate = Partial<InventoryInsert>;

export type InventoryMovementRow = {
  id: string;
  org_id: string;
  product_id: string;
  variant_id: string | null;
  type: "in" | "out" | "adjustment" | "reservation" | "release";
  quantity: number;
  reason: string | null;
  reference_id: string | null;
  performed_by: string | null;
  created_at: string;
};

export type InventoryMovementInsert = Omit<InventoryMovementRow, "id" | "created_at">;
export type InventoryMovementUpdate = Partial<InventoryMovementInsert>;

export type CustomerRow = {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  document_number: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  total_spent: number;
  last_purchase_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerInsert = Omit<CustomerRow, "id" | "created_at" | "updated_at">;
export type CustomerUpdate = Partial<CustomerInsert>;

export type SupplierRow = {
  id: string;
  org_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SupplierInsert = Omit<SupplierRow, "id" | "created_at" | "updated_at">;
export type SupplierUpdate = Partial<SupplierInsert>;

export type OrderRow = {
  id: string;
  org_id: string;
  order_number: string;
  customer_id: string | null;
  status: "pending" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled";
  subtotal: number;
  discount: number;
  shipping_cost: number;
  tax: number;
  total: number;
  shipping_address: Json | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderInsert = Omit<OrderRow, "id" | "created_at" | "updated_at">;
export type OrderUpdate = Partial<OrderInsert>;

export type OrderItemRow = {
  id: string;
  org_id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
};

export type OrderItemInsert = Omit<OrderItemRow, "id" | "created_at">;
export type OrderItemUpdate = Partial<OrderItemInsert>;

export type OrderStatusHistoryRow = {
  id: string;
  order_id: string;
  status: string;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
};

export type OrderStatusHistoryInsert = Omit<OrderStatusHistoryRow, "id" | "created_at">;
export type OrderStatusHistoryUpdate = Partial<OrderStatusHistoryInsert>;

export type PaymentRow = {
  id: string;
  org_id: string;
  order_id: string;
  amount: number;
  method: string;
  status: "pending" | "completed" | "failed" | "refunded";
  reference: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentInsert = Omit<PaymentRow, "id" | "created_at" | "updated_at">;
export type PaymentUpdate = Partial<PaymentInsert>;

// ── Database interface ────────────────────────────────────────────────────────

export interface Database {
  nodo_tienda: {
    Tables: {
      stores: {
        Row: StoreRow;
        Insert: StoreInsert;
        Update: StoreUpdate;
      };
      org_profiles: {
        Row: OrgProfileRow;
        Insert: OrgProfileInsert;
        Update: OrgProfileUpdate;
      };
      categories: {
        Row: CategoryRow;
        Insert: CategoryInsert;
        Update: CategoryUpdate;
      };
      brands: {
        Row: BrandRow;
        Insert: BrandInsert;
        Update: BrandUpdate;
      };
      products: {
        Row: ProductRow;
        Insert: ProductInsert;
        Update: ProductUpdate;
      };
      product_variants: {
        Row: ProductVariantRow;
        Insert: ProductVariantInsert;
        Update: ProductVariantUpdate;
      };
      product_images: {
        Row: ProductImageRow;
        Insert: ProductImageInsert;
        Update: ProductImageUpdate;
      };
      inventory: {
        Row: InventoryRow;
        Insert: InventoryInsert;
        Update: InventoryUpdate;
      };
      inventory_movements: {
        Row: InventoryMovementRow;
        Insert: InventoryMovementInsert;
        Update: InventoryMovementUpdate;
      };
      customers: {
        Row: CustomerRow;
        Insert: CustomerInsert;
        Update: CustomerUpdate;
      };
      suppliers: {
        Row: SupplierRow;
        Insert: SupplierInsert;
        Update: SupplierUpdate;
      };
      orders: {
        Row: OrderRow;
        Insert: OrderInsert;
        Update: OrderUpdate;
      };
      order_items: {
        Row: OrderItemRow;
        Insert: OrderItemInsert;
        Update: OrderItemUpdate;
      };
      order_status_history: {
        Row: OrderStatusHistoryRow;
        Insert: OrderStatusHistoryInsert;
        Update: OrderStatusHistoryUpdate;
      };
      payments: {
        Row: PaymentRow;
        Insert: PaymentInsert;
        Update: PaymentUpdate;
      };
    };
  };
  shared: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; tier: string; product: string; created_at: string };
        Insert: { id?: string; name: string; tier: string; product: string; created_at?: string };
        Update: { id?: string; name?: string; tier?: string; product?: string; created_at?: string };
      };
      org_members: {
        Row: { org_id: string; user_id: string; role: string; created_at: string };
        Insert: { org_id: string; user_id: string; role: string; created_at?: string };
        Update: { org_id?: string; user_id?: string; role?: string; created_at?: string };
      };
    };
  };
}
