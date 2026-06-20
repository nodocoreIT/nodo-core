import { getStore } from "@/lib/get-store";
import { getProductBySlug } from "@/lib/get-products";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AddToCartButton } from "@/components/add-to-cart-button";

interface PageProps {
  params: Promise<{ storeSlug: string; handle: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { storeSlug, handle } = await params;
  const store = await getStore(storeSlug);
  if (!store) return {};
  const product = await getProductBySlug(store.org_id, handle);
  if (!product) return {};
  return {
    title: `${product.name} — ${store.name}`,
    description: product.description ?? undefined,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { storeSlug, handle } = await params;
  const store = await getStore(storeSlug);
  if (!store) notFound();
  const product = await getProductBySlug(store.org_id, handle);
  if (!product) notFound();

  const price = product.promotional_price ?? product.price;
  const hasPromo = !!product.promotional_price;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <nav className="text-sm text-slate-400 mb-6">
        <a href={`/${storeSlug}`} className="hover:text-indigo-600">
          Inicio
        </a>
        <span className="mx-2">/</span>
        <a href={`/${storeSlug}/catalog`} className="hover:text-indigo-600">
          Catálogo
        </a>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Images */}
        <div>
          <div className="aspect-square rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center">
            {product.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.images[0].url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-8xl">📦</span>
            )}
          </div>
          {product.images && product.images.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {product.images.slice(1).map((img, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-slate-100 overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt ?? product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {product.name}
          </h1>
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-indigo-600">
              {formatPrice(price)}
            </span>
            {hasPromo && (
              <span className="text-xl text-slate-400 line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-slate-600 leading-relaxed mb-8">
              {product.description}
            </p>
          )}
          <AddToCartButton
            productId={product.id}
            variantId={null}
            slug={product.slug}
            name={product.name}
            variantLabel={null}
            price={price}
            imageUrl={product.images?.[0]?.url ?? null}
          />
        </div>
      </div>
    </div>
  );
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}
