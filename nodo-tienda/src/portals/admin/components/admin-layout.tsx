import { type ElementType, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Tag,
  BookMarked,
  Users,
  Truck,
  CreditCard,
  Palette,
  Settings,
  LogOut,
  Menu,
  X,
  Lock,
} from "lucide-react";
import {
  Button,
  useAuth,
  useFixedDocumentTitle,
} from "@nodocore/shared-components";
import { BrandMark } from "@/shared/components/brand-mark";
import { useOrgProfile } from "@/features/store-profile/hooks/use-org-profile";
import { cn } from "@/shared/lib/utils";

// ── Nav item definition ───────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: ElementType;
  adminOnly?: boolean;
  proOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/admin/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Pedidos", icon: ShoppingCart },
  { to: "/admin/products", label: "Productos", icon: Package },
  { to: "/admin/inventory", label: "Inventario", icon: Warehouse },
  { to: "/admin/categories", label: "Categorías", icon: Tag },
  { to: "/admin/brands", label: "Marcas", icon: BookMarked },
  { to: "/admin/customers", label: "Clientes", icon: Users },
  { to: "/admin/suppliers", label: "Proveedores", icon: Truck },
  { to: "/admin/payments", label: "Pagos", icon: CreditCard, adminOnly: true },
  { to: "/admin/store-builder", label: "Mi tienda", icon: Palette, proOnly: true },
  { to: "/admin/store-profile", label: "Configuración", icon: Settings, adminOnly: true },
];

// Header title per route
const ROUTE_TITLES: Record<string, string> = {
  "/admin/dashboard": "Inicio",
  "/admin/orders": "Pedidos",
  "/admin/products": "Productos",
  "/admin/inventory": "Inventario",
  "/admin/categories": "Categorías",
  "/admin/brands": "Marcas",
  "/admin/customers": "Clientes",
  "/admin/suppliers": "Proveedores",
  "/admin/payments": "Pagos",
  "/admin/store-builder": "Mi tienda",
  "/admin/store-profile": "Configuración",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(value: string): string {
  const base = value.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function AdminLayout() {
  const { user, role, plan, signOut } = useAuth();
  useOrgProfile(); // preload org profile for ThemeInitializer
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && role !== "admin") return false;
    return true;
  });

  const title = ROUTE_TITLES[pathname] ?? "Gestión";
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const email = user?.email ?? "";
  const displayName = fullName || email;

  useFixedDocumentTitle("Nodo | Tienda");

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-paper">
      {/* Mobile Sidebar/Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 transition-opacity md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed bottom-0 top-0 left-0 z-50 flex h-[100dvh] w-60 flex-shrink-0 flex-col bg-[var(--color-sidebar-bg)] transition-transform duration-300 ease-in-out border-r border-border md:static md:z-auto md:translate-x-0 md:flex",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand mark */}
        <div className="relative mt-2.5 flex h-16 w-full flex-shrink-0 items-center">
          <BrandMark onDark fillWidth iconClassName="h-6 w-6" />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 md:hidden text-[var(--color-sidebar-text)] hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Nav — scrollable middle section */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-4"
          aria-label="Navegación principal"
        >
          <div className="flex flex-col gap-1">
            {visibleNav.map(({ to, label, icon: Icon, proOnly }) => {
              const locked = proOnly && plan !== "pro";
              return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand text-[var(--color-primary-foreground)]"
                        : "text-[var(--color-sidebar-text)] hover:bg-brand/10 hover:text-brand",
                    )
                  }
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {locked && <Lock className="h-3 w-3 opacity-50 flex-shrink-0" />}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Bottom: user section */}
        <div className="flex-shrink-0 border-t border-[var(--color-sidebar-border)] p-3">
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {displayName}
              </p>
              {fullName && (
                <p className="truncate text-xs text-[var(--color-sidebar-text)]">{email}</p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => signOut()}
            className="mt-2 w-full cursor-pointer justify-center gap-2 border-[var(--color-sidebar-border)] bg-transparent text-[var(--color-sidebar-text)] hover:bg-brand/10 hover:text-brand hover:border-brand"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex flex-col sm:flex-row min-h-20 items-center gap-3 sm:gap-4 border-b border-border bg-[#EEF3F8] px-4 sm:px-6 py-3 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto sm:min-w-0 sm:flex-1">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="block md:hidden text-navy hover:text-brand"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menú"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate2">
                  Nodo Tienda · Gestión
                </p>
                <h1 className="truncate text-base sm:text-xl font-bold text-navy">{title}</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
