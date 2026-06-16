import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  FileText,
  CreditCard,
  MessageSquare,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@nodocore/shared-components";
import { BrandMark } from "@/shared/components/brand-mark";
import { cn } from "@/shared/lib/utils";

// ── Nav items ─────────────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/tenant/contrato", label: "Mi Contrato", icon: FileText },
  { to: "/tenant/pagos", label: "Mis Pagos", icon: CreditCard },
  { to: "/tenant/reclamos", label: "Mis Reclamos", icon: MessageSquare },
];

// ── Route title map ───────────────────────────────────────────────────────────

const ROUTE_TITLES: Record<string, string> = {
  "/tenant": "Inicio",
  "/tenant/contrato": "Mi Contrato",
  "/tenant/pagos": "Mis Pagos",
  "/tenant/reclamos": "Mis Reclamos",
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

export function TenantLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const email = user?.email ?? "";
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const displayName = fullName || email;

  const title = ROUTE_TITLES[pathname] ?? "Portal Inquilino";

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-paper">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed bottom-0 top-0 left-0 z-50 flex h-[100dvh] w-60 flex-shrink-0 flex-col bg-[var(--color-sidebar-bg)] border-r border-border transition-transform duration-300 ease-in-out md:static md:z-auto md:translate-x-0 md:flex",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between px-5">
          <BrandMark onDark iconClassName="h-6 w-6" />
          <button
            type="button"
            className="md:hidden text-[var(--color-sidebar-text)] hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Portal label */}
        <div className="px-5 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-sidebar-text)] opacity-60">
            Portal Inquilino
          </span>
        </div>

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-2"
          aria-label="Navegación del inquilino"
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User footer */}
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
                <p className="truncate text-xs text-[var(--color-sidebar-text)]">
                  {email}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => signOut()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-sm border border-[var(--color-sidebar-border)] bg-transparent px-3 py-2 text-sm text-[var(--color-sidebar-text)] transition-colors hover:border-brand hover:bg-brand/10 hover:text-brand"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex min-h-16 flex-shrink-0 items-center gap-3 border-b border-border bg-[#EEF3F8] px-4 sm:px-6 shadow-sm">
          <button
            type="button"
            className="block md:hidden text-navy hover:text-brand"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate2">
              Nodo Inmo · Portal Inquilino
            </p>
            <h1 className="text-base sm:text-xl font-bold text-navy">{title}</h1>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
