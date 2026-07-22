"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Stethoscope,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/nodo/brand-mark";
import { NodoChatBell } from "@/components/nodo-chat/nodo-chat-bell";
import { clinicApi } from "@/lib/clinic/client-api";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";
import { isBrowserSupabaseEnabled } from "@/lib/clinic/config";
import { isPlatformMode } from "@/lib/clinic/platform-config";
import { isProOnlyMedicoRoute } from "@/lib/clinic/pro-features";
import { useConsultorioStore, useConsultorioTheme } from "@/hooks/use-consultorio-theme";
import { mergeThemeSettings } from "@/lib/clinic/theme-settings";
import { Button } from "@/components/ui/button";
import {
  AdminCommandPaletteProvider,
  SidebarNavAccordionProvider,
  SidebarNavGroup,
  SidebarCommandPaletteHint,
  PortalHeaderActions,
  type AdminCommandPaletteItem,
} from "@nodocore/shared-components";
import { NodoSwitcher } from "@nodocore/nodo-modules";
import { MedicoDoctorProvider } from "@/contexts/medico-doctor-context";
import { DoctorSettingsDialog, type SectionId } from "@/components/medical/doctor-settings-dialog";
import { ClinicNotificationsBell } from "@/components/layout/clinic-notifications-bell";
import { PlanBadge } from "@/components/plan/plan-badge";
import { toast } from "sonner";

function mpErrorLabel(code: string) {
  const labels: Record<string, string> = {
    oauth_not_configured: "OAuth no configurado en el servidor (CLIENT_ID / CLIENT_SECRET)",
    invalid_state: "Sesión OAuth expirada — intentá conectar de nuevo",
    expired_state: "El enlace de autorización venció — reconectá",
    session_mismatch: "Iniciá sesión como el mismo médico que conectó",
    missing_code: "Mercado Pago no devolvió el código de autorización",
    token_exchange: "Error al intercambiar el código por tokens",
  };
  return labels[code] ?? code;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/medico/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/medico/consultorio", label: "Consultorio", icon: Stethoscope },
  { href: "/medico/turnos-programados", label: "Turnos Programados", icon: CalendarDays },
  { href: "/medico/cobros", label: "Cobros", icon: Wallet },
  { href: "/medico/interconsultas", label: "Interconsultas", icon: MessageSquare },
];

const ROUTE_TITLES: Record<string, string> = {
  "/medico/dashboard": "Inicio",
  "/medico/consultorio": "Consultorio",
  "/medico/turnos-programados": "Turnos Programados",
  "/medico/cobros": "Cobros",
  "/medico/interconsultas": "Interconsultas",
};

function initials(value: string): string {
  const base = value.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

const commandItems: AdminCommandPaletteItem[] = NAV_ITEMS.map((item) => ({
  id: item.href,
  label: item.label,
  href: item.href,
  group: "Secciones",
}));

export function MedicoAdminLayout({ children }: { children: React.ReactNode }) {
  useConsultorioTheme();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [doctor, setDoctor] = useState<{
    id: string;
    fullName: string;
    email: string;
    subscriptionPlan?: string;
    profilePhotoUrl?: string;
  } | null>(null);
  const [checking, setChecking] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SectionId | undefined>(undefined);
  const [cobrosUnread, setCobrosUnread] = useState(0);
  const mpCallbackHandled = useRef(false);

  const isPro = isProPlan(doctor?.subscriptionPlan);
  const chatEmbedded = pathname === "/medico/interconsultas";

  const refreshCobrosUnread = useCallback(async () => {
    try {
      const data = await clinicApi.getCobrosUnreadCount();
      setCobrosUnread(data.cobrosCount);
    } catch {
      setCobrosUnread(0);
    }
  }, []);

  useEffect(() => {
    if (!doctor) return;
    refreshCobrosUnread();
    const interval = setInterval(refreshCobrosUnread, 10_000);
    const onRead = () => refreshCobrosUnread();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshCobrosUnread();
    };
    window.addEventListener("cobros-notifications-read", onRead);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("cobros-notifications-read", onRead);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [doctor, refreshCobrosUnread]);

  useEffect(() => {
    if (!doctor || !isPro) return;
    clinicApi.pingInterconsultPresence();
    const interval = setInterval(() => clinicApi.pingInterconsultPresence(), 30_000);
    return () => clearInterval(interval);
  }, [doctor, isPro]);

  useEffect(() => {
    clinicApi.getSession().then(async ({ session, user }) => {
      if (!session || !["doctor", "admin", "super_admin"].includes(session.role)) {
        router.push("/login");
        return;
      }
      setDoctor({
        id: user.id,
        fullName: user.fullName,
        email: user.email ?? session.email,
        subscriptionPlan: user.subscriptionPlan,
        profilePhotoUrl: user.profilePhotoUrl,
      });
      try {
        const office = await clinicApi.getDoctorSchedule(user.id);
        if (office.themeSettings) {
          useConsultorioStore.getState().hydrateSettings(
            mergeThemeSettings(office.themeSettings),
          );
        }
        const photo =
          typeof office.profilePhotoData === "string" && office.profilePhotoData
            ? office.profilePhotoData
            : undefined;
        if (photo || office.fullName) {
          setDoctor((d) =>
            d
              ? {
                  ...d,
                  fullName: office.fullName || d.fullName,
                  profilePhotoUrl: photo ?? d.profilePhotoUrl,
                }
              : d,
          );
        }
      } catch {
        /* tema / foto local por defecto */
      }
      setChecking(false);
    });
  }, [router]);

  const title = ROUTE_TITLES[pathname] ?? "Gestión";
  const displayName = doctor?.fullName ?? "Médico";

  useEffect(() => {
    if (!doctor) return;

    const settingsTab = searchParams.get("settings");
    const mp = searchParams.get("mp");

    if (settingsTab === "cobros" || mp === "connected" || mp === "error") {
      setSettingsSection("cobros");
      setSettingsOpen(true);
    }

    if (!mp || mpCallbackHandled.current) return;
    mpCallbackHandled.current = true;

    if (mp === "connected") {
      toast.success(
        "Tu cuenta de Mercado Pago quedó vinculada. Los pacientes pueden pagarte por MP.",
      );
      void clinicApi.getDoctorSchedule(doctor.id).catch(() => {});
    } else if (mp === "error") {
      const msg = searchParams.get("mp_msg") ?? "desconocido";
      toast.error(`No se pudo vincular Mercado Pago: ${mpErrorLabel(msg)}`);
    }

    const clearParams = () => router.replace(pathname, { scroll: false });
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(clearParams);
    } else {
      setTimeout(clearParams, 0);
    }
  }, [searchParams, router, pathname, doctor]);

  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent<{ section?: SectionId }>).detail?.section;
      setSettingsSection(section);
      setSettingsOpen(true);
    };
    window.addEventListener("nodo:open-settings", handler);
    return () => window.removeEventListener("nodo:open-settings", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ fullName?: string; profilePhotoUrl?: string }>).detail;
      if (!detail) return;
      setDoctor((d) =>
        d
          ? {
              ...d,
              fullName: detail.fullName ?? d.fullName,
              profilePhotoUrl: detail.profilePhotoUrl ?? d.profilePhotoUrl,
            }
          : d,
      );
    };
    window.addEventListener("nodo:profile-updated", handler);
    return () => window.removeEventListener("nodo:profile-updated", handler);
  }, []);

  const handleLogout = async () => {
    await clinicApi.logout();
    useConsultorioStore.getState().resetSettings();
    router.push("/login");
  };

  const handleCommandSelect = useCallback(
    (item: AdminCommandPaletteItem) => {
      router.push(item.href);
      setMobileMenuOpen(false);
    },
    [router],
  );

  if (checking || !doctor) {
    return (
      <div className="flex h-dvh items-center justify-center bg-paper">
        <div
          role="status"
          aria-label="Cargando panel"
          className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent"
        />
      </div>
    );
  }

  return (
    <MedicoDoctorProvider doctor={doctor}>
    <AdminCommandPaletteProvider
      items={commandItems}
      onSelectItem={handleCommandSelect}
    >
      <div className="flex h-dvh max-h-dvh overflow-hidden bg-paper">
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 transition-opacity md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside
          className={cn(
            "fixed bottom-0 top-0 left-0 z-50 flex h-dvh max-h-dvh w-60 flex-shrink-0 flex-col bg-[var(--color-sidebar-bg)] transition-transform duration-300 ease-in-out border-r border-[var(--color-sidebar-border)] md:static md:z-auto md:translate-x-0 md:flex",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mt-2.5 flex h-16 flex-shrink-0 items-center justify-between px-5">
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

          <nav
            className="flex-1 overflow-y-auto px-3 py-4"
            aria-label="Navegación principal"
          >
            <SidebarNavAccordionProvider itemCount={NAV_ITEMS.length}>
              <SidebarNavGroup
                groupId="main"
                label="Menú"
                isActive={NAV_ITEMS.some(
                  (item) =>
                    pathname === item.href ||
                    (item.href !== "/medico/dashboard" &&
                      pathname.startsWith(item.href)),
                )}
              >
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const isActive =
                    pathname === href ||
                    (href !== "/medico/dashboard" && pathname.startsWith(href));
                  const proLocked = isProOnlyMedicoRoute(href) && !isPro;
                  const showCobrosBadge =
                    href === "/medico/cobros" && cobrosUnread > 0;
                  return (
                    <Link
                      key={href}
                      href={proLocked ? "/medico/dashboard" : href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]"
                          : "text-[var(--color-sidebar-text)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
                        proLocked && "opacity-50",
                      )}
                      title={proLocked ? "Disponible en Plan Pro" : undefined}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1">{label}</span>
                      {showCobrosBadge && (
                        <span
                          className="ml-auto shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold leading-tight text-white whitespace-nowrap"
                          aria-label={`${cobrosUnread} pago${cobrosUnread === 1 ? "" : "s"} pendiente${cobrosUnread === 1 ? "" : "s"} de revisión`}
                        >
                          {cobrosUnread} Pendiente{cobrosUnread === 1 ? "" : "s"}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </SidebarNavGroup>
            </SidebarNavAccordionProvider>
            <SidebarCommandPaletteHint />
          </nav>

          <div className="flex-shrink-0 border-t border-[var(--color-sidebar-border)] p-3 space-y-2">
            <div className="flex items-center gap-3 px-1 py-1">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--sidebar-primary)] text-xs font-bold text-[var(--sidebar-primary-foreground)]">
                {doctor?.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doctor.profilePhotoUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(displayName)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {displayName}
                </p>
                {doctor?.email && (
                  <p className="truncate text-xs text-[var(--color-sidebar-text)]">
                    {doctor.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Configuración"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className="flex-shrink-0 rounded-md p-1.5 transition-colors text-[var(--color-sidebar-text)] hover:text-[var(--sidebar-accent-foreground)]"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>

            <Button
              variant="outline"
              onClick={handleLogout}
              className="mt-2 w-full justify-center gap-2 border-[var(--color-sidebar-border)] bg-transparent text-[var(--color-sidebar-text)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] hover:border-[var(--sidebar-primary)]"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-16 flex-shrink-0 items-center justify-between gap-4 border-b border-border bg-[#EEF3F8] px-4 py-3 shadow-sm sm:px-6">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="block md:hidden text-[var(--color-navy)] hover:text-[var(--color-primary)]"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menú"
              >
                <Menu className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="block md:hidden rounded-md p-1 text-[var(--color-navy)] hover:text-[var(--color-primary)]"
                onClick={() => setSettingsOpen(true)}
                aria-label="Configuración"
              >
                <Settings className="h-6 w-6" />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate2">
                  Nodo Clínica · Gestión
                </p>
                <h1 className="truncate text-base sm:text-xl font-bold text-navy font-display">
                  {title}
                </h1>
              </div>
            </div>

            {doctor && (
              <PortalHeaderActions
                notifications={
                  <div className="flex items-center gap-0.5">
                    <ClinicNotificationsBell doctorId={doctor.id} />
                    {isPro && (
                      <NodoChatBell
                        isPro={isPro}
                        chatEmbedded={chatEmbedded}
                      />
                    )}
                  </div>
                }
                metrics={<PlanBadge fallbackPlan={doctor.subscriptionPlan} />}
                trailing={
                  isPlatformMode() && isBrowserSupabaseEnabled() ? (
                    <NodoSwitcher product="clinica" />
                  ) : null
                }
              />
            )}
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-6">
            {children}
          </main>
        </div>

        {doctor && (
          <DoctorSettingsDialog
            key={doctor.id}
            open={settingsOpen}
            onOpenChange={(o) => { setSettingsOpen(o); if (!o) setSettingsSection(undefined); }}
            doctorId={doctor.id}
            initialSection={settingsSection}
          />
        )}
      </div>
    </AdminCommandPaletteProvider>
    </MedicoDoctorProvider>
  );
}
