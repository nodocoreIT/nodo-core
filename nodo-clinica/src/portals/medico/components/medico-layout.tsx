import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  Stethoscope,
  ClipboardList,
} from "lucide-react";
import { Button, useAuth } from "@nodocore/shared-components";
import { cn } from "@/shared/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/medico", label: "Dashboard", icon: LayoutDashboard },
  { to: "/medico/pacientes", label: "Pacientes", icon: Users },
  { to: "/medico/agenda", label: "Agenda", icon: Calendar },
  { to: "/medico/recetas", label: "Recetas", icon: ClipboardList },
  { to: "/medico/configuracion", label: "Configuración", icon: Settings },
];

const ROUTE_TITLES: Record<string, string> = {
  "/medico": "Dashboard",
  "/medico/pacientes": "Pacientes",
  "/medico/agenda": "Agenda",
  "/medico/recetas": "Recetas",
  "/medico/configuracion": "Configuración",
};

function initials(value: string): string {
  const base = value.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function MedicoLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(max-width: 640px)");
    setIsMobile(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const title = ROUTE_TITLES[pathname] ?? "Clínica Virtual";
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const email = user?.email ?? "";
  const displayName = fullName || email;

  async function handleSignOut() {
    await signOut();
    window.location.replace("/nodo-clinica/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed bottom-0 top-0 left-0 z-50 flex h-screen w-60 flex-shrink-0 flex-col bg-navy text-white transition-transform duration-300 ease-in-out border-r border-navy-700 md:static md:z-auto md:translate-x-0 md:flex",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between px-5 border-b border-navy-700">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-brand" />
            <span className="font-display font-bold text-white text-sm">
              Nodo Clínica
            </span>
          </div>
          <button
            type="button"
            className="md:hidden text-white/60 hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/medico"}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand text-white"
                      : "text-white/60 hover:bg-brand/10 hover:text-brand"
                  )
                }
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User + logout */}
        <div className="flex-shrink-0 border-t border-navy-700 p-3">
          <div className="flex items-center gap-3 px-1 py-1 mb-2">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {displayName}
              </p>
              {fullName && (
                <p className="truncate text-xs text-white/50">{email}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/medico/configuracion");
              }}
              className="rounded-md p-1.5 text-white/50 hover:text-brand transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full justify-center gap-2 border-navy-700 bg-transparent text-white/60 hover:bg-brand/10 hover:text-brand hover:border-brand"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-[#EEF3F8] px-4 sm:px-6 py-3 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="block md:hidden text-navy hover:text-brand"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate2">
                Nodo Clínica · Portal Médico
              </p>
              <h1 className="text-base sm:text-xl font-bold text-navy">{title}</h1>
            </div>
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
