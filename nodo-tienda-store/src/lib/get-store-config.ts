import { createSupabaseAdmin } from "./supabase";
import { cache } from "react";

export type MenuItem = { label: string; url: string };

export type StoreSection = {
  id: string;
  type:
    | "hero"
    | "featured_products"
    | "categories"
    | "banner"
    | "text"
    | "custom";
  title: string | null;
  config: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
};

export type StoreTheme = {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  borderRadius: "none" | "md" | "full";
  brandText: string;
};

export type StoreConfig = {
  orgId: string;
  storeId: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  theme: StoreTheme;
  sections: StoreSection[];
  headerMenu: MenuItem[];
  footerMenu: MenuItem[];
};

const DEFAULT_THEME: StoreTheme = {
  primaryColor: "#6366f1",
  secondaryColor: "#1e1b4b",
  fontFamily: "Inter",
  borderRadius: "md",
  brandText: "",
};

export const getStoreConfig = cache(
  async (slug: string): Promise<StoreConfig | null> => {
    const admin = createSupabaseAdmin();

    // 1. Fetch store row
    const { data: store } = await admin
      .schema("nodo_tienda")
      .from("stores")
      .select("id, org_id, slug, name, description, logo_url")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (!store) return null;

    // 2. Fetch org_profiles for theme, sections, menus in parallel
    const [profileResult, sectionsResult, menusResult] = await Promise.all([
      admin
        .schema("nodo_tienda")
        .from("org_profiles")
        .select("theme_settings")
        .eq("org_id", store.org_id)
        .maybeSingle(),

      admin
        .schema("nodo_tienda")
        .from("store_sections")
        .select("id, type, title, config, sort_order, is_active")
        .eq("org_id", store.org_id)
        .eq("is_active", true)
        .order("sort_order"),

      admin
        .schema("nodo_tienda")
        .from("store_menus")
        .select("location, items")
        .eq("org_id", store.org_id),
    ]);

    const rawTheme = profileResult.data?.theme_settings as
      | Record<string, unknown>
      | null;
    const theme: StoreTheme = rawTheme
      ? ({ ...DEFAULT_THEME, ...rawTheme } as StoreTheme)
      : DEFAULT_THEME;

    const headerMenu = (
      menusResult.data?.find((m) => m.location === "header")?.items ?? []
    ) as MenuItem[];
    const footerMenu = (
      menusResult.data?.find((m) => m.location === "footer")?.items ?? []
    ) as MenuItem[];

    return {
      orgId: store.org_id,
      storeId: store.id,
      slug: store.slug,
      name: store.name,
      description: store.description,
      logoUrl: store.logo_url,
      theme,
      sections: (sectionsResult.data ?? []) as StoreSection[],
      headerMenu,
      footerMenu,
    };
  },
);
