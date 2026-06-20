import { notFound } from "next/navigation";
import { getStoreConfig } from "@/lib/get-store-config";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { StoreThemeProvider } from "@/components/store-theme-provider";
import { CartProvider } from "@/components/cart-provider";

interface StoreLayoutProps {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}

export default async function StoreLayout({
  children,
  params,
}: StoreLayoutProps) {
  const { storeSlug } = await params;
  const config = await getStoreConfig(storeSlug);

  if (!config) notFound();

  return (
    <StoreThemeProvider theme={config.theme}>
      <CartProvider slug={config.slug}>
        <StoreHeader config={config} />
        <main className="min-h-[60vh]">{children}</main>
        <StoreFooter config={config} />
      </CartProvider>
    </StoreThemeProvider>
  );
}
