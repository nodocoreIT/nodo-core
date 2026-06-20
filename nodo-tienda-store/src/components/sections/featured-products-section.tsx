import type { ProductWithImages } from "@/lib/get-products";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(price);
}

export function FeaturedProductsSection({
  title,
  products,
  slug,
}: {
  title?: string | null;
  products: ProductWithImages[];
  slug: string;
}) {
  if (products.length === 0) return null;

  return (
    <section>
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <a
            key={product.id}
            href={`/${slug}/product/${product.slug}`}
            className="group rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition"
          >
            <div className="aspect-square bg-slate-100 flex items-center justify-center text-slate-400">
              {product.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.images[0].url}
                  alt={product.images[0].alt ?? product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl">📦</span>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-medium text-slate-900 group-hover:opacity-70 transition line-clamp-2">
                {product.name}
              </h3>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatPrice(product.promotional_price ?? product.price)}
              </p>
              {product.promotional_price && (
                <p className="text-sm text-slate-400 line-through">
                  {formatPrice(product.price)}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
