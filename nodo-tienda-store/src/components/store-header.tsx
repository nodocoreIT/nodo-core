import type { StoreConfig } from "@/lib/get-store-config";
import { Search } from "lucide-react";
import { CartIcon } from "@/components/cart-icon";

export function StoreHeader({ config }: { config: StoreConfig }) {
  const { slug, name, logoUrl, headerMenu } = config;

  return (
    <header className="border-b bg-white sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        {/* Brand */}
        <a href={`/${slug}`} className="flex items-center gap-3 shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={name} className="h-8 w-auto" />
          ) : (
            <span
              className="text-xl font-bold"
              style={{ color: "var(--store-primary)" }}
            >
              {name}
            </span>
          )}
        </a>

        {/* Dynamic nav from headerMenu */}
        {headerMenu.length > 0 && (
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            {headerMenu.map((item) => (
              <a
                key={item.url}
                href={item.url}
                className="hover:opacity-80 transition font-medium"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <a
            href={`/${slug}/catalog`}
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition text-slate-600"
          >
            <Search className="w-4 h-4" />
            <span>Buscar</span>
          </a>
          <CartIcon slug={slug} />
        </div>
      </div>
    </header>
  );
}
