import { useEffect, useMemo, useState, useCallback } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Receipt,
  CreditCard,
  Banknote,
  PiggyBank,
  Target,
  Wallet,
  BarChart2,
  Settings,
  Menu,
  X,
  DollarSign,
  LogOut,
  Lock,
  Fingerprint,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PortalHeaderActions,
  PortalHeaderMobileActions,
  SidebarCommandPaletteHint,
  AdminCommandPaletteProvider,
  type AdminCommandPaletteItem,
  useFixedDocumentTitle,
  useAuth,
  useBillingLockout,
} from "@nodocore/shared-components";
import { SettingsDialog, type SettingsTabId } from "@nodocore/nodo-modules/settings";
import { NodoSwitcher } from "@nodocore/nodo-modules";
import { cn } from "@/shared/lib/utils";
import { NotificationBell } from "@/components/ui/notification-bell";
import { FinanzasSettingsModuleProvider } from "@/shared/lib/finanzas-settings-module";
import { OpenSettingsContext } from "@/shared/hooks/use-open-settings";
import { AiSettingsContext, useAiSettingsProvider } from "@/hooks/use-ai-settings";
import { FeedbackFAB, nodoBrandMarkUrl } from "@nodocore/nodo-modules/feedback";
import { supabase } from "@/shared/lib/supabase";

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
  { to: "/admin/presupuestos", label: "Presupuestos", icon: Target },
  { to: "/admin/saldos", label: "Saldos", icon: Wallet },
  { to: "/admin/informe-mensual", label: "Informe Mensual", icon: BarChart2 },
  { to: "/admin/configuracion", label: "Administración", icon: Settings },
];

const ROUTE_TITLES: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/gastos-diarios": "Gastos del Día",
  "/admin/gastos-fijos": "Gastos Fijos",
  "/admin/tarjetas": "Tarjetas",
  "/admin/prestamos": "Préstamos",
  "/admin/planes-ahorro": "Planes de Ahorro",
  "/admin/presupuestos": "Presupuestos",
  "/admin/saldos": "Saldos",
  "/admin/informe-mensual": "Informe Mensual",
  "/admin/configuracion": "Administración",
};

function initials(value: string): string {
  const base = value.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId | undefined>();

  const openSettings = useCallback((tab?: SettingsTabId) => {
    setSettingsInitialTab(tab);
    setSettingsOpen(true);
  }, []);
  const { user, role, plan, billingLocked, accessReason, signOut } = useAuth();
  const aiSettingsValue = useAiSettingsProvider(user?.id);
  const isSuperAdmin = role === "super_admin";

  // Suscripción lives inside the settings dialog now, not a dedicated route —
  // there's nowhere to redirect to, so the gate always fails closed (blocks
  // the route and surfaces a notice) while the effect below opens the dialog
  // on the Suscripción tab so the user can still check their billing status.
  const billingGate = useBillingLockout({ billingLocked, pathname });

  useEffect(() => {
    if (billingGate.shouldRedirect) {
      openSettings("suscripcion");
    }
  }, [billingGate.shouldRedirect, openSettings]);

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
      .find(([key]) => pathname.startsWith(key))?.[1] ?? "Dashboard";

  useFixedDocumentTitle("Nodo | Finanzas");

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const email = user?.email ?? "";
  const displayName = fullName || email;

  async function handleSignOut() {
    await signOut();
  }

  const commandItems = useMemo((): AdminCommandPaletteItem[] => {
    const items = NAV_ITEMS.map((item) => ({
      id: item.to,
      label: item.label,
      href: item.to,
      group: "Secciones",
      keywords: [item.label],
    }));

    items.push(
      {
        id: "/admin/nodo-id",
        label: "Nodo ID",
        href: "/admin/nodo-id",
        group: "Plan Pro",
        keywords: ["nodo id", "pro"],
      },
      {
        id: "/admin/bot-integraciones",
        label: "Bot e Integraciones",
        href: "/admin/bot-integraciones",
        group: "Plan Pro",
        keywords: ["bot", "integraciones", "pro"],
      },
    );

    return items;
  }, []);

  const handleCommandSelect = useCallback(
    (item: AdminCommandPaletteItem) => {
      navigate(item.href);
      setMobileMenuOpen(false);
    },
    [navigate],
  );

  return (
    <AiSettingsContext.Provider value={aiSettingsValue}>
    <AdminCommandPaletteProvider
      items={commandItems}
      onSelectItem={(item) => handleCommandSelect(item)}
    >
    <FinanzasSettingsModuleProvider>
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
            // h-svh (not h-screen/100vh) so iOS Safari's address-bar-visible
            // viewport doesn't clip the footer — see mobile user block below.
            "fixed bottom-0 top-0 left-0 z-50 flex h-svh max-h-svh w-60 flex-shrink-0 flex-col bg-navy text-white transition-transform duration-300 ease-in-out border-r border-navy-700 md:static md:z-auto md:translate-x-0 md:flex",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {/* Brand */}
          <div className="mt-2.5 flex h-16 flex-shrink-0 items-center justify-between border-b border-navy-700 px-5">
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

          {/* Mobile-only: user + settings + logout, pinned right below the
              logo instead of at the bottom — on mobile the footer depended
              on how much space the nav menu left, and iOS Safari's dynamic
              toolbar could push it off-screen entirely. Desktop keeps the
              original bottom-pinned footer below, unchanged. */}
          <div className="md:hidden flex-shrink-0 border-b border-navy-700 px-4 pb-3">
            <div className="flex items-center gap-3 py-1">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {initials(displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{displayName}</p>
                {fullName && (
                  <p className="truncate text-xs text-white/60">{email}</p>
                )}
              </div>
              {isSuperAdmin && (
                <button
                  type="button"
                  aria-label="Administración"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="flex-shrink-0 rounded-md p-1.5 text-white/60 transition-colors hover:text-brand"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                aria-label="Cerrar sesión"
                onClick={() => void handleSignOut()}
                className="flex-shrink-0 rounded-md p-1.5 text-white/60 transition-colors hover:text-brand"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Nav */}
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
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

              {/* Pro features */}
              <div className="mt-3 pt-3 flex flex-col gap-1">
                <div className="mb-1 flex items-center gap-2 px-3">
                  <div className="h-px flex-1 bg-brand/40" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Plan Pro</span>
                  <div className="h-px flex-1 bg-brand/40" />
                </div>
                <NavLink
                  to="/admin/nodo-id"
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
                  <Fingerprint className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">Nodo ID</span>
                  {plan !== "pro" && <Lock className="h-3 w-3 opacity-50 flex-shrink-0" />}
                </NavLink>
                <NavLink
                  to="/admin/bot-integraciones"
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
                  <Bot className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">Bot e Integraciones</span>
                  {plan !== "pro" && <Lock className="h-3 w-3 opacity-50 flex-shrink-0" />}
                </NavLink>
              </div>
            </div>

            <SidebarCommandPaletteHint className="mx-0 border-navy-700" />
          </nav>

          {/* Bottom: user + settings + logout (desktop only, see mobile block above) */}
          <div className="hidden md:block flex-shrink-0 border-t border-navy-700 p-3">
            <div className="flex items-center gap-3 px-1 py-1 mb-2">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {initials(displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{displayName}</p>
                {fullName && (
                  <p className="truncate text-xs text-white/60">{email}</p>
                )}
              </div>
              {isSuperAdmin && (
                <button
                  type="button"
                  aria-label="Administración"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="flex-shrink-0 rounded-md p-1.5 text-white/60 transition-colors hover:text-brand"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => void handleSignOut()}
              className="w-full cursor-pointer justify-center gap-2 border-navy-700 bg-transparent text-white/60 hover:bg-brand/10 hover:text-brand hover:border-brand"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate2">
                    Nodo Finanzas · Panel Admin
                  </p>
                  <h1 className="truncate text-base sm:text-xl font-bold text-navy mt-1.5">{title}</h1>
                </div>
              </div>

              <PortalHeaderMobileActions
                notifications={<NotificationBell />}
                trailing={<NodoSwitcher product="finanzas" />}
              />
            </div>

            <PortalHeaderActions
              notifications={<NotificationBell />}
              trailing={<NodoSwitcher product="finanzas" />}
            />
          </header>

          {/* Content */}
          <main className="min-h-0 flex-1 overflow-auto p-6">
            {billingGate.shouldRedirect ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <Lock className="h-10 w-10 text-slate2" />
                <p className="text-sm text-slate2 max-w-sm">
                  {accessReason === "trial_expired"
                    ? "Tu período de prueba terminó. El nodo quedó pausado — suscribite para seguir usando Nodo Finanzas."
                    : "No pudimos procesar tu último pago. El nodo quedó pausado hasta que regularices la suscripción."}
                </p>
                <Button variant="outline" onClick={() => openSettings("suscripcion")}>
                  Ver mi suscripción
                </Button>
              </div>
            ) : (
              <OpenSettingsContext.Provider value={{ openSettings }}>
                <Outlet />
              </OpenSettingsContext.Provider>
            )}
          </main>
        </div>

        {pathname === "/admin/dashboard" && (
          <FeedbackFAB
            supabase={supabase}
            sourceNode="finanzas"
            imgSrc={nodoBrandMarkUrl("brand/nodo-mark-white.png", import.meta.env.BASE_URL)}
          />
        )}

        <SettingsDialog
          open={settingsOpen}
          onOpenChange={(v) => {
            setSettingsOpen(v);
            if (!v) setSettingsInitialTab(undefined);
          }}
          initialTab={settingsInitialTab}
        />
      </div>
    </FinanzasSettingsModuleProvider>
    </AdminCommandPaletteProvider>
    </AiSettingsContext.Provider>
  );
}
