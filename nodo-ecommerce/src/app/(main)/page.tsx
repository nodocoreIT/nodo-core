import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Producto } from "@/types";
import ProductoGrid from "@/components/productos/ProductoGrid";
import InstagramIcon from "@/components/ui/InstagramIcon";
import { MapPin, ChevronRight, Award } from "lucide-react";
import HeroSlider from "@/components/home/HeroSlider";
import MarcasCarousel from "@/components/home/MarcasCarousel";
import { getSiteConfig } from "@/lib/site-config/getSiteConfig";

async function getProductosDestacados(): Promise<Producto[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .eq("destacado", true)
      .order("created_at", { ascending: false })
      .limit(8);
    return (data as Producto[]) || [];
  } catch {
    return [];
  }
}

async function getProductosNuevos(): Promise<Producto[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .eq("nuevo", true)
      .order("created_at", { ascending: false })
      .limit(4);
    return (data as Producto[]) || [];
  } catch {
    return [];
  }
}

async function getHeroSlides() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("configuracion")
      .select("valor")
      .eq("clave", "hero_slides")
      .single();
    if (!data?.valor) return null;
    const parsed = JSON.parse(data.valor);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

async function getMarcas() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("marcas")
      .select("id, nombre, logo_url")
      .eq("activo", true)
      .order("nombre", { ascending: true });
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [destacados, nuevos, marcas, siteConfig, heroSlides] = await Promise.all([
    getProductosDestacados(),
    getProductosNuevos(),
    getMarcas(),
    getSiteConfig(),
    getHeroSlides(),
  ]);

  return (
    <>
      {/* HERO */}
      <HeroSlider initialSlides={heroSlides ?? undefined} />

      {/* NOVEDADES */}
      {nuevos.length > 0 && (
        <section className="w-full px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-gold text-xs tracking-[0.3em] uppercase mb-2">
                Recién llegados
              </p>
              <h2 className="font-serif text-3xl md:text-4xl text-white">
                Novedades
              </h2>
            </div>
            <Link
              href="/productos?nuevo=true"
              className="hidden sm:flex items-center gap-1 text-luxury-gray-light hover:text-gold text-sm transition-colors"
            >
              Ver todos <ChevronRight size={16} />
            </Link>
          </div>
          <ProductoGrid productos={nuevos} dolarEnabled={siteConfig.feature_precios_usd} showViewToggle={false} />
        </section>
      )}

      {/* DESTACADOS */}
      {destacados.length > 0 && (
        <section className="w-full px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-gold text-xs tracking-[0.3em] uppercase mb-2">
                Selección exclusiva
              </p>
              <h2 className="font-serif text-3xl md:text-4xl text-white">
                Destacados
              </h2>
            </div>
            <Link
              href="/productos?destacado=true"
              className="hidden sm:flex items-center gap-1 text-luxury-gray-light hover:text-gold text-sm transition-colors"
            >
              Ver todos <ChevronRight size={16} />
            </Link>
          </div>
          <ProductoGrid productos={destacados} dolarEnabled={siteConfig.feature_precios_usd} showViewToggle={false} />
        </section>
      )}

      {/* MARCAS */}
      {siteConfig.feature_marcas_carousel && marcas.length > 0 && (
        <MarcasCarousel marcas={marcas} />
      )}
    </>
  );
}
