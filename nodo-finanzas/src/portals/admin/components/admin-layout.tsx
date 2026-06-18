import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Receipt,
  CreditCard,
  Banknote,
  PiggyBank,
  Wallet,
  BarChart2,
  Settings,
  Menu,
  X,
  DollarSign,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PortalHeaderActions,
  PortalHeaderMobileActions,
} from "@nodocore/shared-components";
import { cn } from "@/shared/lib/utils";
import { NotificationBell } from "@/components/ui/notification-bell";
import { DolarCotizacionModal } from "@/components/ui/dolar-cotizacion-modal";
import { useAuth } from "@/shared/hooks/use-auth";
import { useDolar } from "@/hooks/use-dolar";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/gastos-diarios", label: "Gastos del Día", icon: Calendar },
  { to: "/admin/gastos-fijos", label: "Gastos Fijos", icon: Receipt },
  { to: "/admin/tarjetas", label: "Tarjetas", icon: CreditCard },
  { to: "/admin/prestamos", label: "Préstamos", icon: Banknote },
  { to: "/admin/planes-ahorro", label: "Planes de Ahorro", icon: PiggyBank },
  { to: "/admin/saldos", label: "Saldos", icon: Wallet },
  { to: "/admin/informe-mensual", label: "Informe Mensual", icon: BarChart2 },
  { to: "/admin/configuracion", label: "Configuración", icon: Settings },
];

const ROUTE_TITLES: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/gastos-diarios": "Gastos del Día",
  "/admin/gastos-fijos": "Gastos Fijos",
  "/admin/tarjetas": "Tarjetas",
  "/admin/prestamos": "Préstamos",
  "/admin/planes-ahorro": "Planes de Ahorro",
  "/admin/saldos": "Saldos",
  "/admin/informe-mensual": "Informe Mensual",
  "/admin/configuracion": "Configuración",
};

export function AdminLayout() {
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dolarModalOpen, setDolarModalOpen] = useState(false);
  const { signOut } = useAuth();
  const dolar = useDolar();

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(max-width: 640px)");
    const listener = (e: MediaQueryListEvent) => {
      if (!e.matches) setMobileMenuOpen(false);
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  // Find best matching title
  const title =
    Object.entries(ROUTE_TITLES)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([key]) => pathname.startsWith(key))?.[1] ?? "Nodo Finanzas";

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
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between px-5 border-b border-navy-700">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-brand" />
            <span className="font-display font-bold text-white text-sm">
              Nodo Finanzas
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

        {/* Bottom padding */}
        <div className="flex-shrink-0 border-t border-navy-700 p-3">
          <Button
            variant="outline"
            className="w-full justify-center gap-2 border-navy-700 bg-transparent text-white/60 hover:bg-brand/10 hover:text-brand hover:border-brand"
            onClick={() => window.location.replace("/nodo-landing")}
          >
            Nodo Finanzas
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex min-h-16 items-center gap-3 sm:gap-4 border-b border-border bg-[#e8faf0] px-4 sm:px-6 py-3 shadow-sm flex-shrink-0">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              className="block md:hidden text-navy hover:text-brand"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate2">
                Nodo Finanzas · Panel Admin
              </p>
              <h1 className="truncate text-base sm:text-xl font-bold text-navy mt-1.5">{title}</h1>
            </div>
          </div>

          <PortalHeaderMobileActions
            notifications={<NotificationBell />}
            trailing={
              <button
                type="button"
                onClick={() => void signOut()}
                title="Cerrar sesión"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate2 hover:bg-mist hover:text-navy transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            }
          />

          <PortalHeaderActions
            metrics={
              <>
                <button
                  type="button"
                  id="dolar-badge"
                  onClick={() => setDolarModalOpen(true)}
                  title="Ver cotizaciones del dólar"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/20 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <DollarSign className="h-3 w-3" />
                  {dolar.loading && !dolar.cotizacion
                    ? "USD …"
                    : dolar.cotizacion
                      ? `USD ${dolar.tipoDolarSeleccionado.toUpperCase()} · $${dolar.cotizacion.venta.toLocaleString("es-AR")}`
                      : "USD —"}
                </button>

                <DolarCotizacionModal
                  open={dolarModalOpen}
                  onClose={() => setDolarModalOpen(false)}
                  tipoSeleccionado={dolar.tipoDolarSeleccionado}
                  onSelectTipo={(tipo, cotizacion) => dolar.cambiarTipoDolar(tipo, cotizacion)}
                  onCotizacionesLoaded={(lista) => dolar.sincronizarCotizaciones(lista)}
                />
              </>
            }
            notifications={<NotificationBell />}
            trailing={
              <button
                type="button"
                onClick={() => void signOut()}
                title="Cerrar sesión"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate2 hover:bg-mist hover:text-navy transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            }
          />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
