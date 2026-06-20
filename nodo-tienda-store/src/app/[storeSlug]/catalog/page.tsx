import { getStore } from "@/lib/get-store";
import { getProducts } from "@/lib/get-products";
import { getCategories } from "@/lib/get-categories";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}

export default async function CatalogPage({
  params,
  searchParams,
}: PageProps) {
  const { storeSlug } = await params;
  const { category, q } = await searchParams;
  const store = await getStore(storeSlug);
  if (!store) notFound();

  const [products, categories] = await Promise.all([
    getProducts(store.org_id, { categorySlug: category, search: q }),
    getCategories(store.org_id),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex gap-8">
        {/* Sidebar filters */}
        <aside className="hidden md:block w-64 shrink-0">
          <h3 className="font-semibold mb-4 text-slate-900">Categorías</h3>
          <ul className="space-y-2">
            <li>
              <a
                href={`/${storeSlug}/catalog`}
                className={`block px-3 py-2 rounded-lg text-sm ${
                  !category
                    ? "bg-indigo-50 text-indigo-600 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Todos
              </a>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <a
                  href={`/${storeSlug}/catalog?category=${cat.slug}`}
                  className={`block px-3 py-2 rounded-lg text-sm ${
                    category === cat.slug
                      ? "bg-indigo-50 text-indigo-600 font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {cat.name}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Product grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-slate-500 text-sm">{products.length} productos</p>
            <form>
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar productos..."
                className="border border-slate-200 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </form>
          </div>
          {products.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              No hay productos disponibles.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {products.map((product) => (
                <a
                  key={product.id}
                  href={`/${storeSlug}/product/${product.slug}`}
                  className="group rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition"
                >
                  <div className="aspect-square bg-slate-100 flex items-center justify-center">
                    {product.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl">📦</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-slate-900 group-hover:text-indigo-600 transition">
                      {product.name}
                    </h3>
                    <p className="mt-1 font-bold">
                      {formatPrice(product.promotional_price ?? product.price)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
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
