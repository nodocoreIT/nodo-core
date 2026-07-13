import TopBanner from "@/components/layout/TopBanner";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/cart/CartDrawer";
import NewsletterModal from "@/components/layout/NewsletterModal";
import { CartProvider } from "@/context/CartContext";
import { CatalogoProvider } from "@/context/CatalogoContext";
import { DolarProvider } from "@/context/DolarContext";
import CatalogoModal from "@/components/catalogo/CatalogoModal";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import QuickSearchModal from "@/components/ui/QuickSearchModal";
import { createClient } from "@/lib/supabase/server";
import { getSiteConfig } from "@/lib/site-config/getSiteConfig";
import { getThemeConfig } from "@/lib/theme/getThemeConfig";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const [{ data: categorias }, { data: subcategorias }, siteConfig, theme, { data: { user } }] = await Promise.all([
    supabase.from("categorias").select("id, nombre, slug, orden").eq("activo", true).order("orden"),
    supabase.from("subcategorias").select("id, nombre, slug, orden, categoria_id").eq("activo", true).order("orden"),
    getSiteConfig(),
    getThemeConfig(),
    supabase.auth.getUser(),
  ]);

  let customerUser: { name: string; email: string } | null = null;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();
    if (perfil?.rol !== "admin") {
      customerUser = {
        name: user.user_metadata?.full_name || user.email || "",
        email: user.email || "",
      };
    }
  }

  const navCategorias = (categorias || []).map((cat) => ({
    ...cat,
    subcategorias: (subcategorias || []).filter((s) => s.categoria_id === cat.id),
  }));

  return (
    <CartProvider>
      <CatalogoProvider>
        <DolarProvider enabled={siteConfig.feature_precios_usd}>
          {siteConfig.shipping_banner_enabled && (
            <TopBanner
              text={siteConfig.shipping_banner_text}
              freeFrom={siteConfig.shipping_free_from || undefined}
            />
          )}
          <Header
            navCategorias={navCategorias}
            showCatalogo={siteConfig.feature_catalogo}
            showFaq={siteConfig.feature_faq}
            showNosotros={siteConfig.feature_nosotros}
            showQuickSearch={siteConfig.feature_quick_search}
            showDolarWidget={siteConfig.feature_precios_usd}
            logoUrl={theme.logo_url || undefined}
            customerUser={customerUser}
          />
          <main className="flex-1">{children}</main>
          <Footer contact={{
            whatsapp: siteConfig.whatsapp,
            instagram: siteConfig.instagram,
            facebook: siteConfig.facebook,
            tiktok: siteConfig.tiktok,
            contact_address: siteConfig.contact_address,
            contact_horarios: siteConfig.contact_horarios,
            contact_email: siteConfig.contact_email,
          }} />
          <CartDrawer freeShippingFrom={siteConfig.shipping_free_from ? Number(siteConfig.shipping_free_from) : undefined} />
          {siteConfig.feature_newsletter && (
            <NewsletterModal
              title={siteConfig.newsletter_title || undefined}
              body={siteConfig.newsletter_body || undefined}
              footer={siteConfig.newsletter_footer || undefined}
            />
          )}
          {siteConfig.feature_whatsapp && <WhatsAppButton phone={siteConfig.whatsapp || undefined} />}
          {siteConfig.feature_catalogo && <CatalogoModal />}
          <QuickSearchModal />
        </DolarProvider>
      </CatalogoProvider>
    </CartProvider>
  );
}
