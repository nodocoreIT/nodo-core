import type { StoreConfig } from "@/lib/get-store-config";

export function StoreFooter({ config }: { config: StoreConfig }) {
  const { name, footerMenu } = config;

  return (
    <footer className="border-t bg-slate-50 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {footerMenu.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-6 mb-6 text-sm text-slate-500">
            {footerMenu.map((item) => (
              <a
                key={item.url}
                href={item.url}
                className="hover:text-slate-800 transition"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <p className="text-center text-sm text-slate-400">
          © {new Date().getFullYear()} {name}. Todos los derechos reservados.
          <span className="ml-2">
            Powered by{" "}
            <span
              style={{ color: "var(--store-primary)", fontWeight: 500 }}
            >
              nodo tienda
            </span>
          </span>
        </p>
      </div>
    </footer>
  );
}
