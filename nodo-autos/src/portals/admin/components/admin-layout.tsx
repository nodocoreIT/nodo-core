import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  Users,
  Share2,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Calendar,
  Wallet,
} from "lucide-react";
import {
  Button,
  PortalHeaderActions,
  PortalHeaderMobileActions,
  useAuth,
  useFixedDocumentTitle,
} from "@nodocore/shared-components";
import { cn } from "@/shared/lib/utils";
import { useDealershipBrand } from "@/shared/hooks/use-dealership-brand";
import { NotificationsBell } from "@/features/notifications/notifications-bell";
import { SettingsDialog } from "@nodocore/nodo-modules/settings";
import { NodoSwitcher } from "@nodocore/nodo-modules";
import { AutosSettingsModuleProvider } from "@/shared/lib/autos-settings-module";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/vehiculos", label: "Vehículos", icon: Car },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/publicaciones", label: "Redes Sociales", icon: Share2 },
  { to: "/admin/caja", label: "Caja", icon: Wallet },
  { to: "/admin/agenda", label: "Agenda y Tareas", icon: Calendar },
  { to: "/admin/documentacion", label: "Documentación", icon: FileText },
];

const ROUTE_TITLES: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/vehiculos/importar": "Importación masiva",
  "/admin/vehiculos/nuevo": "Nuevo vehículo",
  "/admin/vehiculos": "Stock de vehículos",
  "/admin/clientes": "Clientes",
  "/admin/publicaciones": "Publicaciones",
  "/admin/caja": "Caja",
  "/admin/agenda": "Agenda y Tareas",
  "/admin/documentacion": "Documentación",
};

function initials(value: string): string {
  const base = value.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const { name: dealershipName, logoUrl } = useDealershipBrand();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(max-width: 640px)");
    setIsMobile(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const pageTitle = (() => {
    if (pathname.endsWith("/editar")) return "Editar vehículo";
    if (/^\/admin\/publicaciones\/[^/]+$/.test(pathname)) return "Publicación en redes";
    if (
      /^\/admin\/vehiculos\/[^/]+$/.test(pathname) &&
      !pathname.endsWith("/nuevo") &&
      !pathname.endsWith("/importar")
    ) {
      return "Detalle del vehículo";
    }
    return (
      Object.entries(ROUTE_TITLES)
        .sort((a, b) => b[0].length - a[0].length)
        .find(([key]) => pathname.startsWith(key))?.[1] ?? "Panel"
    );
  })();

  useFixedDocumentTitle("Nodo | Autos");

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const email = user?.email ?? "";
  const displayName = fullName || email;

  async function handleSignOut() {
    await signOut();
    window.location.replace("/nodo-landing/login");
  }

  // Suppress unused variable warning — isMobile used for potential future responsive changes
  void isMobile;

  return (
    <AutosSettingsModuleProvider>
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
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="mt-2.5 flex h-16 flex-shrink-0 items-center justify-between border-b border-navy-700 px-5">
          <div className="flex min-w-0 items-center gap-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={dealershipName}
                className="h-8 w-auto max-w-[7rem] object-contain"
              />
            ) : (
              <Car className="h-5 w-5 shrink-0 text-brand" />
            )}
            <span className="truncate font-display text-sm font-bold text-white">
              {dealershipName}
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
                end
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand text-white"
                      : "text-white/60 hover:bg-brand/10 hover:text-brand",
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
              aria-label="Configuración"
              onClick={() => {
                setMobileMenuOpen(false);
                setSettingsOpen(true);
              }}
              className="flex-shrink-0 rounded-md p-1.5 text-white/60 transition-colors hover:text-brand"
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
        <header className="flex min-h-16 flex-col gap-3 border-b border-border bg-[#EEF3F8] px-4 py-3 shadow-sm flex-shrink-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 sm:justify-start">
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
                  {dealershipName} · Panel Admin
                </p>
                <h1 className="text-base sm:text-xl font-bold text-navy mt-1.5">{pageTitle}</h1>
              </div>
            </div>

            <PortalHeaderMobileActions
              notifications={<NotificationsBell />}
              trailing={<NodoSwitcher product="autos" />}
            />
          </div>

          <PortalHeaderActions
            notifications={<NotificationsBell />}
            trailing={<NodoSwitcher product="autos" />}
          />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
    </AutosSettingsModuleProvider>
  );
}
