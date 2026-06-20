import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ShoppingBag, User, LogOut } from "lucide-react";
import { useAuth } from "@nodocore/shared-components";
import { BrandMark } from "@/shared/components/brand-mark";
import { cn } from "@/shared/lib/utils";

const NAV = [
  { to: "/customer/orders", label: "Mis pedidos", icon: ShoppingBag },
  { to: "/customer/profile", label: "Mis datos", icon: User },
];

export function CustomerLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* Top bar */}
      <header className="border-b border-border bg-navy px-6 py-3 flex items-center justify-between">
        <BrandMark onDark />
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-sm text-slate-400">{user?.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav
          className="hidden md:flex flex-col w-56 border-r border-border bg-[var(--color-sidebar-bg)] p-4 gap-1"
          aria-label="Navegación del portal"
        >
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition",
                  isActive
                    ? "bg-brand/15 text-brand"
                    : "text-[var(--color-sidebar-text)] hover:bg-white/5 hover:text-white",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 p-6 max-w-4xl">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden border-t border-border bg-navy flex" aria-label="Navegación móvil">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition",
                isActive ? "text-brand" : "text-slate-400",
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
