import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Home,
  Users,
  UserCheck,
  FileText,
  CreditCard,
  Wallet,
  FolderOpen,
  Building2,
  Calendar,
  LogOut,
  Settings,
  Menu,
  X,
  HandCoins,
  LineChart,
  Lock,
  AlertCircle,
} from "lucide-react";
import {
  Button,
  GlobalSearchInput,
  PortalHeaderActions,
  PortalHeaderMobileActions,
  useSearchStore,
} from "@nodocore/shared-components";
import { BrandMark } from "@/shared/components/brand-mark";
import { ProfileDialog } from "@/features/profile/components/profile-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { AgencyProfileForm } from "@/features/agency-profile/components/agency-profile-form";
import { useAuth } from "@nodocore/shared-components";
import { useOrgProfile } from "@/features/agency-profile/hooks/use-org-profile";
import { cn } from "@/shared/lib/utils";
import { SettingsDialog } from "@nodocore/nodo-modules/settings";
import { InmoSettingsModuleProvider } from "@/shared/lib/inmo-settings-module";
import { FeedbackFAB } from "@/features/feedback/components/feedback-node";
import { NotificationsBell } from "@/features/dashboard/components/notifications-bell";
import { IPCBadge } from "@/features/ipc/components/IPCBadge";

// ── Nav item definition ───────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  proOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/admin/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/admin/properties", label: "Propiedades", icon: Home },
  { to: "/admin/owners", label: "Propietarios", icon: UserCheck },
  { to: "/admin/tenants", label: "Inquilinos", icon: Users },
  { to: "/admin/contracts", label: "Contratos", icon: FileText },
  { to: "/admin/payments", label: "Pagos", icon: CreditCard },
  { to: "/admin/caja", label: "Caja", icon: Wallet, adminOnly: true },
  { to: "/admin/rendiciones", label: "Rendiciones", icon: HandCoins, adminOnly: true },
  { to: "/admin/ganancias", label: "Ganancias", icon: LineChart, adminOnly: true },
  { to: "/admin/documentos", label: "Documentos", icon: FolderOpen },
  { to: "/admin/agenda", label: "Agenda y Tareas", icon: Calendar },
  { to: "/admin/reclamos", label: "Reclamos", icon: AlertCircle },
  { to: "/admin/portal", label: "Portales", icon: Building2, proOnly: true },
];

// JWT role → display name (matches settings-dialog role permission keys)
const ROLE_DISPLAY: Record<string, string> = {
  admin:   "Administrador",
  agent:   "Vendedor",
  tenant:  "Inquilino",
  owner:   "Propietario",
};

// Top-bar search placeholder per searchable route.
const SEARCH_PLACEHOLDERS: Record<string, string> = {
  "/admin/properties": "Buscar propiedades…",
  "/admin/owners": "Buscar propietarios…",
  "/admin/tenants": "Buscar inquilinos…",
  "/admin/contracts": "Buscar contratos…",
  "/admin/documentos": "Buscar por inquilino, propiedad…",
  "/admin/agenda": "Buscar tareas…",
};

// Header title per route (shown in the top bar, nodo-core style).
const ROUTE_TITLES: Record<string, string> = {
  "/admin/dashboard": "Inicio",
  "/admin/properties": "Propiedades",
  "/admin/owners": "Propietarios",
  "/admin/tenants": "Inquilinos",
  "/admin/contracts": "Contratos",
  "/admin/payments": "Pagos",
  "/admin/caja": "Caja",
  "/admin/rendiciones": "Rendiciones",
  "/admin/ganancias": "Ganancias",
  "/admin/documentos": "Documentos",
  "/admin/agenda": "Agenda y Tareas",
  "/admin/reclamos": "Reclamos",
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
  const { data: profile } = useOrgProfile();
  const { pathname } = useLocation();
  const resetSearch = useSearchStore((s) => s.reset);
  const [profileOpen, setProfileOpen] = useState(false);
  const [agencyProfileOpen, setAgencyProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // Clear the search query when switching areas so they don't inherit it.
  useEffect(() => {
    resetSearch();
  }, [pathname, resetSearch]);

  const themeSettings = profile?.theme_settings as Record<string, unknown> | null;
  const userPermissions = themeSettings?.userPermissions as Record<string, string[]> | undefined;
  const rolePermissions = themeSettings?.rolePermissions as Record<string, string[]> | undefined;
  const displayRole = ROLE_DISPLAY[role ?? ""] ?? "Colega";
  const userId = user?.id;

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && role !== "admin") return false;
    if (userId && userPermissions?.[userId]) {
      return userPermissions[userId].includes(item.to);
    }
    if (rolePermissions?.[displayRole]) {
      return rolePermissions[displayRole].includes(item.to);
    }
    return true;
  });

  const placeholder = SEARCH_PLACEHOLDERS[pathname]
    ? (isMobile ? "Buscar..." : SEARCH_PLACEHOLDERS[pathname])
    : undefined;
  const title = ROUTE_TITLES[pathname] ?? "Gestión";
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const email = user?.email ?? "";
  const displayName = fullName || email;

  return (
    <InmoSettingsModuleProvider>
    <div className="flex h-[100dvh] overflow-hidden bg-paper">
      {/* Mobile Sidebar/Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 transition-opacity md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar (Responsive: Sidebar on Desktop, Drawer on Mobile) ── */}
      <aside
        className={cn(
          "fixed bottom-0 top-0 left-0 z-50 flex h-[100dvh] w-60 flex-shrink-0 flex-col bg-[var(--color-sidebar-bg)] transition-transform duration-300 ease-in-out border-r border-border md:static md:z-auto md:translate-x-0 md:flex",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand mark — full sidebar width */}
        <div className="relative flex h-16 w-full flex-shrink-0 items-center">
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

        {/* Bottom: configuración + user — always visible */}
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
            <button
              type="button"
              aria-label="Configuración"
              onClick={() => {
                setMobileMenuOpen(false);
                setSettingsOpen(true);
              }}
              className="flex-shrink-0 rounded-md p-1.5 text-[var(--color-sidebar-text)] transition-colors hover:text-brand"
            >
              <Settings className="h-4 w-4" />
            </button>
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
        {/* Top bar — stacked on mobile, single line on desktop */}
        <header className="flex flex-col sm:flex-row min-h-20 items-center gap-3 sm:gap-4 border-b border-border bg-[#EEF3F8] px-4 sm:px-6 py-3 shadow-sm flex-shrink-0">
          {/* Row 1 / Left Section */}
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
                  Nodo Inmo · Gestión
                </p>
                <h1 className="truncate text-base sm:text-xl font-bold text-navy">{title}</h1>
              </div>
            </div>

            <PortalHeaderMobileActions
              metrics={<IPCBadge />}
              notifications={<NotificationsBell />}
            />
          </div>

          <PortalHeaderActions
            search={
              placeholder ? (
                <GlobalSearchInput placeholder={placeholder} />
              ) : undefined
            }
            metrics={<IPCBadge />}
            notifications={<NotificationsBell />}
          />
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Profile editor */}
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        currentName={fullName}
        email={email}
      />

      {/* Agency profile settings (admin-only) */}
      <Dialog open={agencyProfileOpen} onOpenChange={setAgencyProfileOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Datos de la agencia</DialogTitle>
            <DialogDescription>
              Información que aparece en el comprobante de liquidación.
            </DialogDescription>
          </DialogHeader>
          <AgencyProfileForm onSuccess={() => setAgencyProfileOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Global Config Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Floating feedback node (only on Dashboard/Inicio) */}
      {pathname === "/admin/dashboard" && <FeedbackFAB />}
    </div>
    </InmoSettingsModuleProvider>
  );
}
