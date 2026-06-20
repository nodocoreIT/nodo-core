import { notFound } from "next/navigation";
import { getStoreConfig } from "@/lib/get-store-config";
import { getFeaturedProducts } from "@/lib/get-products";
import { getCategories } from "@/lib/get-categories";
import {
  HeroSection,
  type HeroConfig,
} from "@/components/sections/hero-section";
import { FeaturedProductsSection } from "@/components/sections/featured-products-section";
import { CategoriesSection } from "@/components/sections/categories-section";
import {
  BannerSection,
  type BannerConfig,
} from "@/components/sections/banner-section";
import { TextSection } from "@/components/sections/text-section";

interface PageProps {
  params: Promise<{ storeSlug: string }>;
}

export default async function StorePage({ params }: PageProps) {
  const { storeSlug } = await params;
  const config = await getStoreConfig(storeSlug);
  if (!config) notFound();

  const sections = config.sections;

  // No sections configured → default layout
  if (sections.length === 0) {
    const featured = await getFeaturedProducts(config.orgId, { limit: 8 });
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <HeroSection
          config={{
            title: config.name,
            subtitle: config.description ?? "",
            cta_label: "Ver catálogo",
            cta_url: `/${storeSlug}/catalog`,
          }}
          slug={storeSlug}
          primaryColor="var(--store-primary)"
        />
        <FeaturedProductsSection
          title="Productos destacados"
          products={featured}
          slug={storeSlug}
        />
      </div>
    );
  }

  // Render sections in order — sequential awaits inside map are fine here
  // because some sections depend on their own async data fetch
  const sectionElements = await Promise.all(
    sections.map(async (section) => {
      switch (section.type) {
        case "hero":
          return (
            <HeroSection
              key={section.id}
              config={section.config as HeroConfig}
              slug={storeSlug}
              primaryColor="var(--store-primary)"
            />
          );

        case "featured_products": {
          const limit = (section.config.limit as number | undefined) ?? 8;
          const products = await getFeaturedProducts(config.orgId, { limit });
          return (
            <FeaturedProductsSection
              key={section.id}
              title={section.title}
              products={products}
              slug={storeSlug}
            />
          );
        }

        case "categories": {
          const cats = await getCategories(config.orgId);
          return (
            <CategoriesSection
              key={section.id}
              title={section.title}
              categories={cats}
              slug={storeSlug}
            />
          );
        }

        case "banner":
          return (
            <BannerSection
              key={section.id}
              config={section.config as BannerConfig}
              slug={storeSlug}
            />
          );

        case "text":
          return (
            <TextSection
              key={section.id}
              title={section.title}
              content={(section.config.content as string) ?? ""}
            />
          );

        default:
          return null;
      }
    }),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-16">
      {sectionElements}
    </div>
  );
}
